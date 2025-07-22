import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { Logger } from '@nestjs/common';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConcurrencyService } from '../common/services/concurrency.service';
import { PdfMergerService } from './pdf-merger.service';

interface TemplateConfig {
  templatePath: string;
  stylesPath: string;
}

interface PdfRequest {
  resolve: (value: Buffer) => void;
  reject: (error: Error) => void;
  data: any;
  customerStrategy?: string;
}

@Injectable()
export class PdfService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  private browser: puppeteer.Browser | null = null;
  private browserInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  private pagePool: puppeteer.Page[] = [];
  private readonly maxPoolSize = 3;
  private readonly maxConcurrency = 3;
  private currentConcurrency = 0;
  private readonly pendingRequests: PdfRequest[] = [];
  private cleanupTimeoutId: NodeJS.Timeout | null = null;
  private readonly isDevelopment = process.env.NODE_ENV === 'development';
  private isShuttingDown = false;
  private browserPid: number | null = null;
  private browserStartTime: number = 0;
  private readonly browserMaxAge = this.isDevelopment
    ? 5 * 60 * 1000
    : 60 * 60 * 1000; // 5min dev, 1h prod
  private healthCheckInterval: NodeJS.Timeout | null = null;

  // Template caching
  private readonly templateCache = new Map<
    string,
    handlebars.TemplateDelegate
  >();
  private readonly stylesCache = new Map<string, string>();
  private readonly templateConfigs = new Map<string, TemplateConfig>();

  constructor(
    private readonly concurrencyService: ConcurrencyService,
    private readonly pdfMergerService: PdfMergerService,
  ) {}

  async onModuleInit() {
    this.setupTemplateConfigs();
    this.registerHandlebarsHelpers();
    await this.precompileTemplates();

    // In production, initialize browser immediately for better performance
    // In development, use lazy initialization to avoid hot reload conflicts
    if (!this.isDevelopment) {
      this.initializationPromise = this.initializeBrowser();
      await this.initializationPromise;
    }
  }

  async onModuleDestroy() {
    this.logger.log('PdfService shutting down, cleaning up resources...');
    this.isShuttingDown = true;

    // Clear any cleanup timeouts
    if (this.cleanupTimeoutId) {
      clearTimeout(this.cleanupTimeoutId);
      this.cleanupTimeoutId = null;
    }

    await this.cleanup();
  }

  private setupTemplateConfigs(): void {
    const viewsDir = path.join(__dirname, '../../views');

    this.templateConfigs.set('default', {
      templatePath: path.join(viewsDir, 'templates', 'default.hbs'),
      stylesPath: path.join(viewsDir, 'styles', 'base.css'),
    });

    this.templateConfigs.set('georgia-baptist', {
      templatePath: path.join(viewsDir, 'templates', 'georgia-baptist.hbs'),
      stylesPath: path.join(viewsDir, 'styles', 'base.css'),
    });

    this.templateConfigs.set('inquire-ed', {
      templatePath: path.join(viewsDir, 'templates', 'inquire-ed.hbs'),
      stylesPath: path.join(viewsDir, 'styles', 'base.css'),
    });
  }

  private async precompileTemplates(): Promise<void> {
    this.logger.log('Pre-compiling templates...');

    // Clear existing cache first (important for development hot reload)
    this.templateCache.clear();
    this.stylesCache.clear();

    for (const [customerStrategy, config] of this.templateConfigs.entries()) {
      try {
        // Load and compile template
        const templateContent = await fs.promises.readFile(
          config.templatePath,
          'utf8',
        );

        const compiledTemplate = handlebars.compile(templateContent);
        this.templateCache.set(customerStrategy, compiledTemplate);

        // Load and cache styles
        const stylesContent = await fs.promises.readFile(
          config.stylesPath,
          'utf8',
        );
        this.stylesCache.set(customerStrategy, stylesContent);

        this.logger.log(`Template cached for strategy: ${customerStrategy}`);
      } catch (error) {
        this.logger.error(
          `Failed to precompile template for ${customerStrategy}:`,
          error,
        );
      }
    }

    this.logger.log('Templates precompiled successfully');
  }

  private registerHandlebarsHelpers(): void {
    // Register equality helper for conditional logic
    handlebars.registerHelper('eq', function (a: any, b: any) {
      return a === b;
    });

    this.logger.log('Handlebars helpers registered');
  }

  private async initializeBrowser(): Promise<void> {
    if (this.browserInitialized || this.isShuttingDown) {
      return;
    }

    try {
      this.logger.log(
        `Initializing browser (${this.isDevelopment ? 'development' : 'production'} mode)...`,
      );

      const launchOptions: puppeteer.LaunchOptions = {
        headless: true,
        timeout: this.isDevelopment ? 15000 : 30000, // Shorter timeout in dev
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=site-per-process',
          '--disable-extensions',
          '--disable-gpu',
          '--disable-default-apps',
          '--disable-translate',
          '--disable-device-discovery-notifications',
          '--disable-software-rasterizer',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
          '--disable-ipc-flooding-protection',
          '--memory-pressure-off',
        ],
      };

      // Development-specific optimizations
      if (this.isDevelopment) {
        launchOptions.args?.push(
          '--single-process', // Avoid subprocess issues in dev
          '--no-zygote', // Simplify process management
        );
      }

      this.browser = await puppeteer.launch(launchOptions);
      this.browserPid = this.browser.process()?.pid || null;
      this.browserInitialized = true;

      this.browserStartTime = Date.now();
      this.logger.log(
        `Browser initialized successfully (PID: ${this.browserPid})`,
      );

      // Set up process error handlers
      if (this.browser.process()) {
        this.browser.process()!.on('error', (error) => {
          this.logger.error('Browser process error:', error);
          this.handleBrowserError(error);
        });

        this.browser.process()!.on('exit', (code, signal) => {
          this.logger.warn(
            `Browser process exited with code ${code}, signal ${signal}`,
          );
          this.browserInitialized = false;
          this.browser = null;
          this.browserPid = null;
          this.browserStartTime = 0;
        });
      }

      // Start health check in development mode
      if (this.isDevelopment) {
        this.startHealthCheck();
      }
    } catch (error) {
      this.logger.error('Failed to initialize browser:', error);
      this.browserInitialized = false;
      this.browser = null;
      this.browserPid = null;
      throw error;
    }
  }

  private async cleanup(): Promise<void> {
    const cleanupTimeout = this.isDevelopment ? 5000 : 10000;

    return new Promise<void>((resolve) => {
      // Set a timeout to ensure cleanup doesn't hang indefinitely
      const timeoutId = setTimeout(() => {
        this.logger.warn(
          `Cleanup timeout after ${cleanupTimeout}ms, forcing cleanup...`,
        );
        this.forceCleanup();
        resolve();
      }, cleanupTimeout);

      this.performCleanup()
        .then(() => {
          clearTimeout(timeoutId);
          resolve();
        })
        .catch((error) => {
          this.logger.error('Error during cleanup:', error);
          clearTimeout(timeoutId);
          this.forceCleanup();
          resolve();
        });
    });
  }

  private async performCleanup(): Promise<void> {
    this.logger.log('Starting graceful cleanup...');

    // Clear pending requests first
    this.pendingRequests.forEach((request) => {
      request.reject(new Error('Service shutting down'));
    });
    this.pendingRequests.length = 0;

    if (this.browser) {
      try {
        this.logger.log(
          `Closing browser instance (PID: ${this.browserPid})...`,
        );

        // Close all pages first with timeout
        const pages = await this.browser.pages();
        const pageClosePromises = pages.map(async (page) => {
          try {
            if (!page.isClosed()) {
              await Promise.race([
                page.close(),
                new Promise((_, reject) =>
                  setTimeout(
                    () => reject(new Error('Page close timeout')),
                    2000,
                  ),
                ),
              ]);
            }
          } catch (error) {
            this.logger.warn('Error closing page:', error);
          }
        });

        await Promise.all(pageClosePromises);

        // Close browser with timeout
        await Promise.race([
          this.browser.close(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Browser close timeout')), 3000),
          ),
        ]);

        this.logger.log('Browser instance closed successfully');
      } catch (error) {
        this.logger.warn('Error during graceful browser close:', error);
        await this.forceBrowserKill();
      }
    }

    // Reset state
    this.browserInitialized = false;
    this.browser = null;
    this.browserPid = null;
    this.pagePool = [];
    this.currentConcurrency = 0;
    this.initializationPromise = null;
    this.browserStartTime = 0;

    // Stop health check
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Clear template caches only in development for hot reload
    if (this.isDevelopment) {
      this.templateCache.clear();
      this.stylesCache.clear();
    }

    this.logger.log('Graceful cleanup completed');
  }

  private async forceBrowserKill(): Promise<void> {
    if (this.browser) {
      try {
        const process = this.browser.process();
        if (process && !process.killed) {
          this.logger.warn(
            `Force killing browser process (PID: ${this.browserPid})...`,
          );

          // Try SIGTERM first
          process.kill('SIGTERM');

          // Wait a moment, then SIGKILL if needed
          setTimeout(() => {
            if (process && !process.killed) {
              this.logger.warn('SIGTERM failed, using SIGKILL...');
              process.kill('SIGKILL');
            }
          }, 1000);
        }
      } catch (killError) {
        this.logger.warn('Error force killing browser:', killError);
      }
    }
  }

  private forceCleanup(): void {
    this.logger.warn('Performing force cleanup...');

    // Force kill browser if it exists
    if (this.browserPid) {
      try {
        process.kill(this.browserPid, 'SIGKILL');
        this.logger.warn(`Force killed browser process ${this.browserPid}`);
      } catch (error) {
        this.logger.warn(`Could not kill process ${this.browserPid}:`, error);
      }
    }

    // Reset all state immediately
    this.browserInitialized = false;
    this.browser = null;
    this.browserPid = null;
    this.pagePool = [];
    this.pendingRequests.length = 0;
    this.currentConcurrency = 0;
    this.initializationPromise = null;

    if (this.isDevelopment) {
      this.templateCache.clear();
      this.stylesCache.clear();
    }

    // Stop health check
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    this.browserStartTime = 0;
    this.logger.log('Force cleanup completed');
  }

  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Check browser health every 30 seconds in development
    this.healthCheckInterval = setInterval(async () => {
      if (!this.isShuttingDown) {
        await this.checkBrowserHealth();
      }
    }, 30000);
  }

  private async checkBrowserHealth(): Promise<void> {
    if (!this.browser || !this.browserInitialized) {
      return;
    }

    try {
      // Check if browser is still responsive
      await Promise.race([
        this.browser.version(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), 5000),
        ),
      ]);

      // Check browser age for recycling in development
      const browserAge = Date.now() - this.browserStartTime;
      if (this.isDevelopment && browserAge > this.browserMaxAge) {
        this.logger.log(
          `Browser recycling: age ${Math.round(browserAge / 1000)}s exceeds max ${Math.round(this.browserMaxAge / 1000)}s`,
        );
        await this.recycleBrowser();
      }
    } catch (error) {
      this.logger.warn('Browser health check failed:', error);
      await this.handleBrowserError(error);
    }
  }

  private async recycleBrowser(): Promise<void> {
    if (this.isShuttingDown || this.currentConcurrency > 0) {
      return; // Don't recycle during active operations
    }

    this.logger.log('Recycling browser instance...');

    try {
      // Graceful shutdown of current browser
      await this.performCleanup();

      // Wait a moment for cleanup
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Initialize new browser
      this.initializationPromise = this.initializeBrowser();
      await this.initializationPromise;

      this.logger.log('Browser recycled successfully');
    } catch (error) {
      this.logger.error('Error recycling browser:', error);
    }
  }

  private async handleBrowserError(error: any): Promise<void> {
    this.logger.error('Handling browser error:', error);

    // Mark browser as unhealthy
    this.browserInitialized = false;

    // Attempt recovery
    try {
      await this.recoverBrowser();
    } catch (recoveryError) {
      this.logger.error('Browser recovery failed:', recoveryError);
    }
  }

  private async recoverBrowser(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.logger.log('Attempting browser recovery...');

    try {
      // Full cleanup first
      await this.cleanup();

      // Wait a moment for cleanup to complete
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Reinitialize browser and templates
      this.initializationPromise = this.initializeBrowser();
      await this.initializationPromise;

      // Refresh templates during recovery (especially important in development)
      if (this.isDevelopment) {
        await this.precompileTemplates();
      }

      this.logger.log('Browser recovery completed');
    } catch (error) {
      this.logger.error('Browser recovery failed:', error);
      throw error;
    }
  }

  // Method to force refresh templates during development
  async refreshTemplates(): Promise<void> {
    this.logger.log('Force refreshing templates...');
    await this.precompileTemplates();
  }

  // Development helper to invalidate specific templates
  async invalidateTemplate(customerStrategy: string): Promise<void> {
    if (!this.isDevelopment) {
      return;
    }

    this.templateCache.delete(customerStrategy);
    this.stylesCache.delete(customerStrategy);

    // Recompile the specific template
    const config = this.templateConfigs.get(customerStrategy);
    if (config) {
      try {
        const templateContent = await fs.promises.readFile(
          config.templatePath,
          'utf8',
        );
        const compiledTemplate = handlebars.compile(templateContent);
        this.templateCache.set(customerStrategy, compiledTemplate);

        const stylesContent = await fs.promises.readFile(
          config.stylesPath,
          'utf8',
        );
        this.stylesCache.set(customerStrategy, stylesContent);

        this.logger.log(
          `Template invalidated and recompiled: ${customerStrategy}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to recompile template ${customerStrategy}:`,
          error,
        );
      }
    }
  }

  // Generate HTML preview using the same templates as PDF generation
  async generatePackingSlipHtmlPreview(
    packingSlipData: any,
    customerCode: string = 'default',
  ): Promise<string> {
    try {
      // Map customer code to strategy (same logic as PDF generation)
      const customerStrategy = this.getCustomerStrategy(customerCode);
      
      // Use the same HTML generation method as PDF creation
      const html = await this.generatePackingSlipHtml(
        packingSlipData,
        customerStrategy,
      );
      
      return html;
    } catch (error) {
      this.logger.error('Error generating HTML preview:', error);
      throw error;
    }
  }

  private async getPage(): Promise<puppeteer.Page> {
    if (this.pagePool.length > 0) {
      return this.pagePool.pop()!;
    }

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    try {
      const page = await this.browser.newPage();
      await page.setViewport({
        width: 816,
        height: 1056,
        deviceScaleFactor: 1,
      });
      return page;
    } catch (error) {
      this.logger.error(
        'Failed to create new page, attempting browser recovery:',
        error,
      );
      await this.recoverBrowser();

      if (!this.browser) {
        throw new Error('Browser not initialized after recovery');
      }

      const page = await this.browser.newPage();
      await page.setViewport({
        width: 816,
        height: 1056,
        deviceScaleFactor: 1,
      });
      return page;
    }
  }

  private async returnPage(page: puppeteer.Page): Promise<void> {
    if (this.pagePool.length < this.maxPoolSize && !page.isClosed()) {
      try {
        await page.goto('about:blank');
        this.pagePool.push(page);
      } catch (error) {
        this.logger.warn('Error returning page to pool:', error);
        try {
          await page.close();
        } catch (closeError) {
          this.logger.warn('Error closing page:', closeError);
        }
      }
    } else {
      try {
        await page.close();
      } catch (error) {
        this.logger.warn('Error closing page:', error);
      }
    }
  }

  // Single PDF generation
  async generatePackingSlipPdf(
    packingSlipData: any,
    customerStrategy: string = 'default',
  ): Promise<Buffer> {
    if (this.isShuttingDown) {
      throw new Error('PDF service is shutting down');
    }

    await this.ensureBrowserReady();

    return new Promise((resolve, reject) => {
      this.pendingRequests.push({
        resolve,
        reject,
        data: packingSlipData,
        customerStrategy,
      });
      this.processQueue();
    });
  }

  private async ensureBrowserReady(): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('Service is shutting down');
    }

    // If browser is already ready, return immediately
    if (this.browserInitialized && this.browser) {
      return;
    }

    // If initialization is already in progress, wait for it
    if (this.initializationPromise) {
      await this.initializationPromise;
      if (this.browserInitialized && this.browser) {
        return;
      }
    }

    // Start initialization if not already started
    this.initializationPromise = this.initializeBrowser();
    await this.initializationPromise;

    if (!this.browserInitialized || !this.browser) {
      throw new Error('Failed to initialize browser');
    }
  }

  // Batch PDF generation
  async generateBatchPDFs(customerCode: string, kits: any[]): Promise<Buffer> {
    if (this.isShuttingDown) {
      throw new Error('PDF service is shutting down');
    }

    // Ensure browser is ready before starting batch generation
    await this.ensureBrowserReady();

    const sessionId = `${customerCode}-${Date.now()}`;
    const tempDir = path.join(os.tmpdir(), 'wg-packing-slips', sessionId);

    try {
      // Create temp directory
      await fs.promises.mkdir(tempDir, { recursive: true });
      this.logger.log(`Created temp directory: ${tempDir}`);

      // Determine customer strategy based on customer code
      const customerStrategy = this.getCustomerStrategy(customerCode);

      // Generate PDFs concurrently with limiter
      const limiter = this.concurrencyService.createLimiter(5);

      const promises = kits.map((kit, index) =>
        limiter.add(() =>
          this.generateSinglePdfFile(kit, tempDir, index, customerStrategy),
        ),
      );

      const pdfFiles = await Promise.all(promises);
      this.logger.log(`Generated ${pdfFiles.length} PDFs`);

      // Merge PDFs using the dedicated merger service
      const mergedPdfBuffer = await this.pdfMergerService.mergePdfs(pdfFiles);
      this.logger.log('PDFs merged successfully');

      return mergedPdfBuffer;
    } finally {
      // Cleanup temp directory
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
        this.logger.log(`Cleaned up temp directory: ${tempDir}`);
      } catch (error) {
        this.logger.warn(`Failed to cleanup temp directory: ${error.message}`);
      }
    }
  }

  private async processQueue(): Promise<void> {
    if (
      this.currentConcurrency >= this.maxConcurrency ||
      this.pendingRequests.length === 0
    ) {
      return;
    }

    const request = this.pendingRequests.shift();
    if (!request) return;

    this.currentConcurrency++;

    try {
      const pdf = await this.generatePdfInternal(
        request.data,
        request.customerStrategy || 'default',
      );
      request.resolve(pdf);
    } catch (error) {
      request.reject(error);
    } finally {
      this.currentConcurrency--;
      this.processQueue();
    }
  }

  private async generatePdfInternal(
    packingSlipData: any,
    customerStrategy: string,
  ): Promise<Buffer> {
    let page: puppeteer.Page;

    try {
      page = await this.getPage();
    } catch (error) {
      this.logger.error('Failed to get page:', error);
      throw error;
    }

    try {
      const html = await this.generatePackingSlipHtml(
        packingSlipData,
        customerStrategy,
      );

      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      const pdf = await page.pdf({
        format: 'letter',
        margin: { top: '.5cm', right: '.5cm', bottom: '.5cm', left: '.5cm' },
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>', // Empty header to just create space
        footerTemplate: '<div></div>', // Empty footer to just create space
      });

      return Buffer.from(pdf);
    } catch (error) {
      this.logger.error('Error generating PDF:', error);
      // Close the page instead of returning it to pool if there was an error
      try {
        await page.close();
      } catch (closeError) {
        this.logger.warn(
          'Error closing page after PDF generation error:',
          closeError,
        );
      }
      throw error;
    } finally {
      if (page && !page.isClosed()) {
        await this.returnPage(page);
      }
    }
  }

  private async generateSinglePdfFile(
    kit: any,
    tempDir: string,
    index: number,
    customerStrategy: string,
  ): Promise<string> {
    try {
      // Convert kit data to the expected format
      const packingSlipData = this.convertKitToPackingSlipData(kit);

      // Generate PDF using internal method
      const pdfBuffer = await this.generatePdfInternal(
        packingSlipData,
        customerStrategy,
      );

      // Save to temp file with order type prefix
      const orderType = kit.metadata?.customFields?.fileType || 'unknown';
      const orderTypePrefix = orderType.toUpperCase();
      const filename = `${String(index).padStart(3, '0')}-${orderTypePrefix}-${kit.id}.pdf`;
      const filepath = path.join(tempDir, filename);
      await fs.promises.writeFile(filepath, pdfBuffer);

      return filepath;
    } catch (error) {
      this.logger.error(`Failed to generate PDF for kit ${kit.id}:`, error);
      throw error;
    }
  }

  private async generatePackingSlipHtml(
    data: any,
    customerStrategy: string,
  ): Promise<string> {
    const template = this.templateCache.get(customerStrategy);
    const styles = this.stylesCache.get(customerStrategy);

    if (!template) {
      throw new Error(
        `Template not found for customer strategy: ${customerStrategy}`,
      );
    }

    if (!styles) {
      throw new Error(
        `Styles not found for customer strategy: ${customerStrategy}`,
      );
    }

    // Prepare template data
    const templateData = this.prepareTemplateData(data);

    // Compile template with styles
    const html = template({
      ...templateData,
      styles,
    });

    return html;
  }

  private prepareTemplateData(data: any): any {
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    // Calculate summary data
    const totalItems = data.order?.items?.length || 0;
    const totalQuantity =
      data.order?.items?.reduce(
        (sum: number, item: any) => sum + item.quantity,
        0,
      ) || 0;

    // Debug logging
    this.logger.debug(`[PDF-DEBUG] Processing PDF for company: "${data.order?.customer?.company}" with deliveryInfo:`, data.deliveryInfo);
    this.logger.debug(
      'prepareTemplateData - shippingMethod:',
      data.shippingMethod,
    );
    this.logger.debug('prepareTemplateData - orderType:', data.orderType);

    const templateData = {
      // Ship to information
      shipTo: {
        name: data.order?.customer?.name || '',
        company: data.order?.customer?.company || '',
        address: {
          street: data.order?.customer?.shippingAddress?.street || '',
          city: data.order?.customer?.shippingAddress?.city || '',
          state: data.order?.customer?.shippingAddress?.state || '',
          zipCode: data.order?.customer?.shippingAddress?.zipCode || '',
          country: data.order?.customer?.shippingAddress?.country || 'US',
        },
        email: data.order?.customer?.email || '',
      },

      // Items
      items: data.order?.items || [],

      // Summary
      summary: {
        totalItems,
        totalQuantity,
      },

      // Job info
      jobInfo: {
        jobNumber: data.jobNumber || '',
      },

      // Special instructions
      specialInstructions: data.specialInstructions || '',

      // Generated date
      generatedDate: formatDate(data.generatedDate || new Date().toISOString()),

      // Order type for conditional templates (InquireEd: 'pm' or 'te')
      orderType: data.orderType || 'pm',

      // Delivery information for InquireEd templates
      deliveryInfo: data.deliveryInfo || null,
      shippingMethod: data.shippingMethod || 'Standard Ground',
    };

    return templateData;
  }

  private getCustomerStrategy(customerCode: string): string {
    // Map customer codes to template strategies
    const customerStrategies: { [key: string]: string } = {
      GEORGIA_BAPTIST: 'georgia-baptist',
      INQUIRE_ED: 'inquire-ed',
      HH_GLOBAL: 'default',
      default: 'default',
    };

    return customerStrategies[customerCode] || 'default';
  }

  private convertKitToPackingSlipData(kit: any): any {
    const deliveryInfo = kit.metadata?.customFields?.deliveryInfo;
    const shippingMethod = this.calculateShippingMethod(deliveryInfo);

    return {
      order: {
        customer: {
          name: kit.recipient.name,
          company: kit.recipient.company,
          email: kit.recipient.email,
          shippingAddress: {
            street: kit.recipient.address.street,
            city: kit.recipient.address.city,
            state: kit.recipient.address.state,
            zipCode: kit.recipient.address.zipCode,
            country: kit.recipient.address.country || 'USA',
          },
        },
        items: kit.items,
      },
      jobNumber: kit.jobNumber || '',
      specialInstructions: kit.metadata?.specialInstructions || '',
      generatedDate: new Date().toISOString(),
      // Add order type for InquireEd conditional templates
      orderType: kit.metadata?.customFields?.fileType || 'pm',
      // Add delivery information for InquireEd templates
      deliveryInfo: deliveryInfo || {},
      shippingMethod: shippingMethod,
    };
  }

  private calculateShippingMethod(deliveryInfo: any): string {
    if (!deliveryInfo) {
      return 'Standard Ground';
    }

    // InquireEd shipping logic based on Dock and Paved Path columns
    if (deliveryInfo.hasDock) {
      return 'Standard LTL Shipment';
    } else if (deliveryInfo.hasPavedPath) {
      return 'LTL Shipment with lift gate & inside delivery';
    } else {
      return 'LTL Shipment with white glove service';
    }
  }
}
