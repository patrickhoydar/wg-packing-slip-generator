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
  private initializationPromise: Promise<void>;
  private pagePool: puppeteer.Page[] = [];
  private readonly maxPoolSize = 3;
  private readonly maxConcurrency = 3;
  private currentConcurrency = 0;
  private readonly pendingRequests: PdfRequest[] = [];

  // Template caching
  private readonly templateCache = new Map<string, handlebars.TemplateDelegate>();
  private readonly stylesCache = new Map<string, string>();
  private readonly templateConfigs = new Map<string, TemplateConfig>();

  constructor(
    private readonly concurrencyService: ConcurrencyService,
    private readonly pdfMergerService: PdfMergerService,
  ) {}

  async onModuleInit() {
    this.initializationPromise = this.initializeBrowser();
    await this.initializationPromise;
    this.setupTemplateConfigs();
    this.registerHandlebarsHelpers();
    await this.precompileTemplates();
  }

  async onModuleDestroy() {
    this.logger.log('PdfService shutting down, cleaning up resources...');
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
        this.logger.log(`Loading template from: ${config.templatePath}`);
        const templateContent = await fs.promises.readFile(config.templatePath, 'utf8');
        const compiledTemplate = handlebars.compile(templateContent);
        this.templateCache.set(customerStrategy, compiledTemplate);

        // Load and cache styles
        this.logger.log(`Loading styles from: ${config.stylesPath}`);
        const stylesContent = await fs.promises.readFile(config.stylesPath, 'utf8');
        this.stylesCache.set(customerStrategy, stylesContent);

        this.logger.log(`Template cached for strategy: ${customerStrategy}`);
      } catch (error) {
        this.logger.error(`Failed to precompile template for ${customerStrategy}:`, error);
        this.logger.error(`Template path: ${config.templatePath}`);
        this.logger.error(`Styles path: ${config.stylesPath}`);
      }
    }

    this.logger.log('Templates precompiled successfully');
  }

  private registerHandlebarsHelpers(): void {
    // Register equality helper for conditional logic
    handlebars.registerHelper('eq', function(a: any, b: any) {
      return a === b;
    });

    this.logger.log('Handlebars helpers registered');
  }

  private async initializeBrowser(): Promise<void> {
    try {
      this.logger.log('Initializing persistent browser instance...');
      this.browser = await puppeteer.launch({
        headless: true,
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
      });
      this.browserInitialized = true;
      this.logger.log('Browser instance initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize browser:', error);
      throw error;
    }
  }

  private async cleanup(): Promise<void> {
    if (this.browser) {
      try {
        this.logger.log('Closing browser instance...');
        // Close all pages first
        const pages = await this.browser.pages();
        for (const page of pages) {
          try {
            await page.close();
          } catch (error) {
            this.logger.warn('Error closing page:', error);
          }
        }
        // Close browser
        await this.browser.close();
        this.logger.log('Browser instance closed successfully');
      } catch (error) {
        this.logger.warn('Error closing browser:', error);
        // Force kill if needed
        try {
          this.browser.process()?.kill('SIGKILL');
        } catch (killError) {
          this.logger.warn('Error force killing browser:', killError);
        }
      }
      this.browserInitialized = false;
      this.browser = null;
    }
    
    // Clear caches
    this.pagePool = [];
    this.templateCache.clear();
    this.stylesCache.clear();
    this.pendingRequests.length = 0;
    this.currentConcurrency = 0;
    
    this.logger.log('All resources cleaned up');
  }

  private async recoverBrowser(): Promise<void> {
    this.logger.log('Attempting browser recovery...');

    // Full cleanup first
    await this.cleanup();

    // Wait a moment for cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Reinitialize browser
    await this.initializeBrowser();
    this.logger.log('Browser recovery completed');
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
    if (!this.browserInitialized) {
      await this.initializationPromise;
    }

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

  // Batch PDF generation
  async generateBatchPDFs(customerCode: string, kits: any[]): Promise<Buffer> {
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
        limiter.add(() => this.generateSinglePdfFile(kit, tempDir, index, customerStrategy)),
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
      const pdfBuffer = await this.generatePdfInternal(packingSlipData, customerStrategy);

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
      throw new Error(`Template not found for customer strategy: ${customerStrategy}`);
    }

    if (!styles) {
      throw new Error(`Styles not found for customer strategy: ${customerStrategy}`);
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
    const totalQuantity = data.order?.items?.reduce(
      (sum: number, item: any) => sum + item.quantity,
      0,
    ) || 0;

    return {
      // Ship to information
      shipTo: {
        name: data.order?.customer?.name || '',
        company: data.order?.customer?.company || '',
        address: {
          street: data.order?.customer?.shippingAddress?.street || '',
          city: data.order?.customer?.shippingAddress?.city || '',
          state: data.order?.customer?.shippingAddress?.state || '',
          zipCode: data.order?.customer?.shippingAddress?.zipCode || '',
          country: data.order?.customer?.shippingAddress?.country || 'USA',
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
    };
  }

  private getCustomerStrategy(customerCode: string): string {
    // Map customer codes to template strategies
    const customerStrategies: { [key: string]: string } = {
      'GEORGIA_BAPTIST': 'georgia-baptist',
      'INQUIRE_ED': 'inquire-ed',
      'HH_GLOBAL': 'default',
      'default': 'default',
    };

    return customerStrategies[customerCode] || 'default';
  }

  private convertKitToPackingSlipData(kit: any): any {
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
    };
  }
}