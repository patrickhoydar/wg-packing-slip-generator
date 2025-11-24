import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { Logger } from '@nestjs/common';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConcurrencyService } from '../common/services/concurrency.service';
import { PdfMergerService } from './pdf-merger.service';
import { CustomerStrategyFactory } from '../customers/strategies/base/customer-strategy.factory';
import { HHGlobalStrategy } from '../customers/strategies/hh-global/hh-global.strategy';
import { GeorgiaBaptistStrategy } from '../customers/strategies/georgia-baptist/georgia-baptist.strategy';
import { InquirEDStrategy } from '../customers/strategies/inquired/inquired.strategy';
import { ScholasticStrategy } from '../customers/strategies/scholastic/scholastic.strategy';

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
  private readonly maxPoolSize = 5;
  private readonly maxConcurrency = 5;
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
    private readonly customerStrategyFactory: CustomerStrategyFactory,
    private readonly hhGlobalStrategy: HHGlobalStrategy,
    private readonly georgiaBaptistStrategy: GeorgiaBaptistStrategy,
    private readonly inquirEDStrategy: InquirEDStrategy,
    private readonly scholasticStrategy: ScholasticStrategy,
  ) {}

  async onModuleInit() {
    // Register all available strategies
    this.customerStrategyFactory.registerStrategy(
      'HH_GLOBAL',
      this.hhGlobalStrategy,
    );
    this.customerStrategyFactory.registerStrategy(
      'GEORGIA_BAPTIST',
      this.georgiaBaptistStrategy,
    );
    this.customerStrategyFactory.registerStrategy(
      'INQUIRED',
      this.inquirEDStrategy,
    );
    this.customerStrategyFactory.registerStrategy(
      'SCHOLASTIC',
      this.scholasticStrategy,
    );    this.customerStrategyFactory.registerStrategy(
      'scholastic',
      this.scholasticStrategy,
    );

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
    const viewsDir = path.join(__dirname, '..', '..', 'views');

    this.templateConfigs.set('default', {
      templatePath: path.join(viewsDir, 'templates', 'default.hbs'),
      stylesPath: path.join(viewsDir, 'styles', 'base.css'),
    });

    this.templateConfigs.set('georgia-baptist', {
      templatePath: path.join(viewsDir, 'templates', 'georgia-baptist.hbs'),
      stylesPath: path.join(viewsDir, 'styles', 'base.css'),
    });

    this.templateConfigs.set('INQUIRED', {
      templatePath: path.join(viewsDir, 'templates', 'inquired.hbs'),
      stylesPath: path.join(viewsDir, 'styles', 'base.css'),
    });

    this.templateConfigs.set('scholastic', {
      templatePath: path.join(viewsDir, 'templates', 'scholastic.hbs'),
      stylesPath: path.join(viewsDir, 'styles', 'scholastic.css'),
    });
    
    this.templateConfigs.set('SCHOLASTIC', {
      templatePath: path.join(viewsDir, 'templates', 'scholastic.hbs'),
      stylesPath: path.join(viewsDir, 'styles', 'scholastic.css'),
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

      // Immediate reinitialize - no wait needed

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

      // Immediate reinitialize - no wait needed

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
      const customerStrategy = this.getCustomerStrategy(customerCode);

      // Generate the base HTML fragment
      const htmlFragment = await this.generatePackingSlipHtml(
        packingSlipData,
        customerStrategy,
      );

      // Get styles and prepend them for the preview
      const styles = this.stylesCache.get(customerStrategy);
      if (!styles) {
        throw new Error(
          `Styles not found for customer strategy: ${customerStrategy}`,
        );
      }

      return `<style>${styles}</style>${htmlFragment}`;
    } catch (error) {
      this.logger.error('Error generating HTML preview:', error);
      throw error;
    }
  }

  private async getPage(): Promise<puppeteer.Page> {
    // Try to get page from pool first
    if (this.pagePool.length > 0) {
      const page = this.pagePool.pop()!;
      
      // Verify the page is still valid
      try {
        if (page.isClosed()) {
          // Page was closed, create a new one
          return this.createNewPage();
        }
        
        // Test if page is still responsive
        await page.evaluate(() => true);
        return page;
      } catch (error) {
        // Page is not responsive, create a new one
        this.logger.warn('Pooled page is not responsive, creating new page');
        await this.safeClosePage(page);
        return this.createNewPage();
      }
    }

    return this.createNewPage();
  }

  private async createNewPage(): Promise<puppeteer.Page> {
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
    try {
      // Check if page is closed before attempting any operations
      if (page.isClosed()) {
        return;
      }

      // If pool is not full, reset and return page to pool
      if (this.pagePool.length < this.maxPoolSize) {
        try {
          // Navigate to blank page to clear any state
          await page.goto('about:blank', {
            waitUntil: 'domcontentloaded',
            timeout: 5000,
          });
          this.pagePool.push(page);
        } catch (error) {
          // If navigation fails, close the page
          this.logger.warn('Error resetting page for pool, will close it:', error);
          await this.safeClosePage(page);
        }
      } else {
        // Pool is full, close the page
        await this.safeClosePage(page);
      }
    } catch (error) {
      this.logger.error('Error in returnPage:', error);
    }
  }

  private async safeClosePage(page: puppeteer.Page): Promise<void> {
    try {
      if (!page.isClosed()) {
        await page.close();
      }
    } catch (error) {
      this.logger.warn('Error closing page:', error);
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

  // Batch PDF generation with chunking and local storage
  async generateBatchPDFsToDirectory(
    customerCode: string,
    kits: any[],
    outputDir: string,
    chunkSize: number = 100,
  ): Promise<{
    totalGenerated: number;
    outputDirectory: string;
    chunks: Array<{
      chunkIndex: number;
      startIndex: number;
      endIndex: number;
      filesGenerated: number;
      error?: string;
    }>;
  }> {
    if (this.isShuttingDown) {
      throw new Error('PDF service is shutting down');
    }

    // Ensure browser is ready before starting batch generation
    await this.ensureBrowserReady();

    // Create output directory
    try {
      await fs.promises.mkdir(outputDir, { recursive: true });
      this.logger.log(`Created output directory: ${outputDir}`);

      // Verify directory was created successfully
      const stats = await fs.promises.stat(outputDir);
      if (!stats.isDirectory()) {
        throw new Error(`Failed to create directory: ${outputDir}`);
      }
      this.logger.log(`Directory verified: ${outputDir}`);
    } catch (error) {
      this.logger.error(
        `Failed to create output directory: ${outputDir}`,
        error,
      );
      throw error;
    }

    // Determine customer strategy based on customer code
    const customerStrategy = this.getCustomerStrategy(customerCode);

    // Split kits into chunks
    const chunks: any[][] = [];
    for (let i = 0; i < kits.length; i += chunkSize) {
      chunks.push(kits.slice(i, i + chunkSize));
    }

    this.logger.log(
      `Processing ${kits.length} kits in ${chunks.length} chunks of ${chunkSize}`,
    );

    const results: Array<{
      chunkIndex: number;
      startIndex: number;
      endIndex: number;
      filesGenerated: number;
      error?: string;
    }> = [];
    let totalGenerated = 0;

    // Process each chunk sequentially to avoid overwhelming the browser
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      const startIndex = chunkIndex * chunkSize;
      const endIndex = startIndex + chunk.length - 1;

      this.logger.log(
        `[PROGRESS] Processing chunk ${chunkIndex + 1}/${chunks.length} (kits ${startIndex}-${endIndex}) - ${Math.round((chunkIndex / chunks.length) * 100)}% complete`,
      );

      try {
        // Force browser recovery less frequently for speed
        if (chunkIndex > 0 && chunkIndex % 10 === 0) {
          this.logger.log(
            `[BROWSER] Recycling browser after ${chunkIndex} chunks to prevent memory issues`,
          );
          await this.recycleBrowser();
        }

        // Generate PDFs for this chunk with higher concurrency for speed
        const limiter = this.concurrencyService.createLimiter(8); // Increased for speed

        const chunkStartTime = Date.now();
        const chunkPromises = chunk.map((kit, kitIndex) => {
          const globalIndex = startIndex + kitIndex;
          return limiter.add(() =>
            this.generateSinglePdfFile(
              kit,
              outputDir,
              globalIndex,
              customerStrategy,
            ),
          );
        });

        const chunkFiles = await Promise.all(chunkPromises);
        const filesGenerated = chunkFiles.filter((file) => file).length;
        totalGenerated += filesGenerated;
        const chunkDuration = Date.now() - chunkStartTime;

        results.push({
          chunkIndex,
          startIndex,
          endIndex,
          filesGenerated,
        });

        const totalProgress = Math.round((totalGenerated / kits.length) * 100);
        const estimatedTimeRemaining =
          chunks.length > chunkIndex + 1
            ? Math.round(
                (chunkDuration * (chunks.length - chunkIndex - 1)) / 1000,
              )
            : 0;

        this.logger.log(
          `[PROGRESS] Chunk ${chunkIndex + 1}/${chunks.length} completed: ${filesGenerated} PDFs in ${Math.round(chunkDuration / 1000)}s | Total: ${totalGenerated}/${kits.length} (${totalProgress}%) | ETA: ${estimatedTimeRemaining}s`,
        );

        // No delay needed - browser pooling handles recovery
      } catch (error) {
        this.logger.error(`Error processing chunk ${chunkIndex + 1}:`, error);
        results.push({
          chunkIndex,
          startIndex,
          endIndex,
          filesGenerated: 0,
          error: error.message,
        });
      }
    }

    this.logger.log(
      `Batch generation completed: ${totalGenerated}/${kits.length} PDFs generated`,
    );

    return {
      totalGenerated,
      outputDirectory: outputDir,
      chunks: results,
    };
  }

  // Legacy batch PDF generation (kept for backward compatibility)
  async generateBatchPDFs(customerCode: string, kits: any[]): Promise<Buffer> {
    if (this.isShuttingDown) {
      throw new Error('PDF service is shutting down');
    }

    // Ensure browser is ready before starting batch generation
    await this.ensureBrowserReady();

    const sessionId = `${customerCode}-${Date.now()}`;
    const tempDir = path.join(os.tmpdir(), 'wg-packing-slips', sessionId);

    try {
      // Create temp directory with better error handling
      await fs.promises.mkdir(tempDir, { recursive: true });
      this.logger.log(`Created temp directory: ${tempDir}`);

      // Verify directory was created
      const stats = await fs.promises.stat(tempDir);
      if (!stats.isDirectory()) {
        throw new Error(`Failed to create temp directory: ${tempDir}`);
      }

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
    let page: puppeteer.Page | null = null;
    let shouldClosePage = false;

    try {
      page = await this.getPage();
    } catch (error) {
      this.logger.error('Failed to get page:', error);
      throw error;
    }

    try {
      const htmlFragment = await this.generatePackingSlipHtml(
        packingSlipData,
        customerStrategy,
      );

      const styles = this.stylesCache.get(customerStrategy);
      if (!styles) {
        throw new Error(
          `Styles not found for customer strategy: ${customerStrategy}`,
        );
      }

      const html = this.generatePdfHtml(htmlFragment, styles);

      await page.setContent(html, {
        waitUntil: 'domcontentloaded', // Faster than networkidle0
        timeout: 10000, // Reduced timeout
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

      // Successfully generated PDF, return page to pool
      await this.returnPage(page);
      return Buffer.from(pdf);
    } catch (error) {
      this.logger.error('Error generating PDF:', error);
      shouldClosePage = true;
      
      // Try to close the page if there was an error
      if (page && !page.isClosed()) {
        try {
          await page.close();
        } catch (closeError) {
          this.logger.warn('Error closing page after PDF generation error:', closeError);
        }
      }
      throw error;
    }
  }

  private generatePdfHtml(content: string, styles: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Packing Slip</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>${styles}</style>
      </head>
      <body>
        ${content}
      </body>
      </html>
    `;
  }

  private async generateSinglePdfFile(
    kit: any,
    outputDir: string,
    index: number,
    customerStrategy: string,
  ): Promise<string> {
    try {
      // Ensure output directory exists
      await fs.promises.mkdir(outputDir, { recursive: true });

      // Convert kit data to the expected format
      const packingSlipData = this.convertKitToPackingSlipData(kit);

      // Generate PDF using internal method
      const pdfBuffer = await this.generatePdfInternal(
        packingSlipData,
        customerStrategy,
      );

      // Save to output file with RFRNC2 as prefix and order type
      const orderType = kit.metadata?.customFields?.fileType || 'unknown';
      const orderTypePrefix = orderType.toUpperCase();
      const rfrnc2 = kit.metadata?.ref2 || String(index).padStart(3, '0'); // Fallback to index if RFRNC2 not available
      const filename = `${String(rfrnc2).padStart(3, '0')}-${orderTypePrefix}-${kit.id}.pdf`;
      const filepath = path.join(outputDir, filename);

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

    if (!template) {
      throw new Error(
        `Template not found for customer strategy: ${customerStrategy}`,
      );
    }

    // Prepare template data
    const templateData = this.prepareTemplateData(data);

    // DEBUG: Log the template data to see what we're passing to the template
    console.log('[PDF-TEMPLATE-DEBUG] Template data structure:', {
      hasJobInfo: !!templateData.jobInfo,
      jobNumber: templateData.jobInfo?.jobNumber,
      hasShipmentInfo: !!templateData.shipmentInfo,
      shipmentInfo: templateData.shipmentInfo,
    });

    // Compile template
    const html = template(templateData);

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

    // For Scholastic templates with frontend data structure
    if (data.shipTo && data.orderDetails) {
      return {
        ...data,
        generatedDate: formatDate(data.generatedDate || new Date().toISOString()),
      };
    }

    // Calculate summary data
    const totalItems = data.order?.items?.length || 0;
    const totalQuantity =
      data.order?.items?.reduce(
        (sum: number, item: any) => sum + item.quantity,
        0,
      ) || 0;

    // Debug logging for phone number issue
    if (data.order?.customer?.company?.includes('Detroit')) {
      console.log('[DEBUG] Detroit customer data:', {
        name: data.order?.customer?.name,
        company: data.order?.customer?.company,
        phone: data.order?.customer?.phone,
        email: data.order?.customer?.email,
      });
    }

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
        phone: data.order?.customer?.phone || '',
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

      // Shipment info (for ERP integration)
      shipmentInfo: {
        shipmentId: data.shipmentInfo?.shipmentId || data.shipmentId || '',
        erpShipmentId:
          data.shipmentInfo?.erpShipmentId ||
          data.erpShipmentId ||
          data.shipmentId ||
          '',
        erpSystem: data.shipmentInfo?.erpSystem || data.erpSystem || '',
      },

      // Special instructions
      specialInstructions: data.specialInstructions || '',

      // Generated date
      generatedDate: formatDate(data.generatedDate || new Date().toISOString()),

      // Order type for conditional templates (InquirED: 'pm' or 'te')
      orderType: data.orderType || 'pm',

      // Delivery information for InquirED templates
      deliveryInfo: data.deliveryInfo || null,
      shippingMethod: data.shippingMethod || 'Standard Ground',

      // CRITICAL: Pass through the entire kit object for customer-specific templates
      metadata: data.metadata || null,

      // Pass through Scholastic-specific fields if present
      boxTitle: data.boxTitle,
      boxNumber: data.boxNumber,
      totalBoxes: data.totalBoxes,
      orderDetails: data.orderDetails,
      studentDetails: data.studentDetails,
    };

    return templateData;
  }

  private getCustomerStrategy(customerCode: string): string {
    // Map customer codes to template strategies
    const customerStrategies: { [key: string]: string } = {
      GEORGIA_BAPTIST: 'georgia-baptist',
      INQUIRED: 'INQUIRED',
      HH_GLOBAL: 'default',
      DEFAULT: 'default',
    };

    return customerStrategies[customerCode.toUpperCase()] || 'default';
  }

  private convertKitToPackingSlipData(kit: any): any {
    const deliveryInfo = kit.metadata?.customFields?.deliveryInfo;
    const shippingMethod = this.calculateShippingMethod(kit);

    return {
      order: {
        customer: {
          name: kit.recipient.name,
          company: kit.recipient.company,
          email: kit.recipient.email,
          phone: kit.recipient.phone,
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
      shipmentId: kit.shipmentId || '',
      erpShipmentId: kit.erpShipmentId || '', // Add ERP shipment ID
      specialInstructions: kit.metadata?.specialInstructions || '',
      generatedDate: new Date().toISOString(),
      // Add order type for InquirED conditional templates
      orderType: kit.metadata?.customFields?.fileType || 'pm',
      // Add delivery information for InquirED templates
      deliveryInfo: deliveryInfo || {},
      shippingMethod: shippingMethod,
      // CRITICAL: Pass through the entire kit object so template has access to metadata
      metadata: kit.metadata || null,
    };
  }

  private calculateShippingMethod(kit: any): string {
    if (!kit?.customerCode) {
      return 'Standard Ground';
    }

    try {
      // Get the customer strategy and use its shipping rules
      const strategy = this.customerStrategyFactory.getStrategy(
        kit.customerCode,
      );
      const shippingRules = strategy.getShippingRules(kit);
      return shippingRules.method;
    } catch (error) {
      this.logger.warn(
        `Failed to get shipping method from strategy for ${kit.customerCode}:`,
        error,
      );

      // Fallback to old logic for backward compatibility
      const deliveryInfo = kit.metadata?.customFields?.deliveryInfo;
      if (!deliveryInfo) {
        return 'Standard Ground';
      }

      // Old InquirED shipping logic based on Dock and Paved Path columns
      if (deliveryInfo.hasDock) {
        return 'Standard LTL Shipment';
      } else if (deliveryInfo.hasPavedPath) {
        return 'LTL Shipment with lift gate & inside delivery';
      } else {
        return 'LTL Shipment with white glove service';
      }
    }
  }

  async createMergedPdfFromDirectory(directoryPath: string): Promise<Buffer> {
    return await this.pdfMergerService.mergePdfsFromDirectory(directoryPath);
  }
}
