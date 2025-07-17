import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { Logger } from '@nestjs/common';

@Injectable()
export class PdfService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  private browser: puppeteer.Browser;
  private browserInitialized = false;
  private initializationPromise: Promise<void>;
  private pagePool: puppeteer.Page[] = [];
  private readonly maxPoolSize = 3;
  private readonly maxConcurrency = 3;
  private currentConcurrency = 0;
  private readonly pendingRequests: Array<{
    resolve: (value: Buffer) => void;
    reject: (error: Error) => void;
    data: any;
  }> = [];
  private cachedBaseTemplate: string;
  private cachedStyles: string;
  async onModuleInit() {
    this.initializationPromise = this.initializeBrowser();
    await this.initializationPromise;
    this.precompileTemplates();
  }

  async onModuleDestroy() {
    await this.cleanup();
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
        await this.browser.close();
      } catch (error) {
        this.logger.warn('Error closing browser:', error);
      }
      this.browserInitialized = false;
      this.logger.log('Browser instance closed');
    }
  }

  private async recoverBrowser(): Promise<void> {
    this.logger.log('Attempting browser recovery...');

    // Clear page pool
    this.pagePool = [];

    // Close existing browser if it exists
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        this.logger.warn('Error closing browser during recovery:', error);
      }
    }

    // Reinitialize browser
    await this.initializeBrowser();
    this.logger.log('Browser recovery completed');
  }

  private precompileTemplates(): void {
    this.cachedStyles = `
      <style>
        * {
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        
        body {
          margin: 0;
          padding: 0;
          background: white;
          color: black;
          font-family: Arial, Helvetica, sans-serif;
        }
        
        .packing-slip-container {
          max-width: none;
          margin: 0;
          padding: 0;
          box-shadow: none;
          background: white;
          border-radius: 0;
        }
        
        .packing-slip-content {
          padding: 2rem;
        }
        
        @page {
          margin: 0;
          size: letter;
        }
      </style>
    `;

    this.cachedBaseTemplate = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Packing Slip</title>
          <script src="https://cdn.tailwindcss.com"></script>
          ${this.cachedStyles}
        </head>
        <body>
          <div class="packing-slip-container">
            <div class="packing-slip-content">
              {{CONTENT}}
            </div>
          </div>
        </body>
      </html>
    `;

    this.logger.log('Templates precompiled successfully');
  }

  private async getPage(): Promise<puppeteer.Page> {
    if (this.pagePool.length > 0) {
      return this.pagePool.pop()!;
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

  async generatePackingSlipPdf(packingSlipData: any): Promise<Buffer> {
    if (!this.browserInitialized) {
      await this.initializationPromise;
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.push({ resolve, reject, data: packingSlipData });
      this.processQueue();
    });
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
      const pdf = await this.generatePdfInternal(request.data);
      request.resolve(pdf);
    } catch (error) {
      request.reject(error);
    } finally {
      this.currentConcurrency--;
      this.processQueue();
    }
  }

  private async generatePdfInternal(packingSlipData: any): Promise<Buffer> {
    let page: puppeteer.Page;

    try {
      page = await this.getPage();
    } catch (error) {
      this.logger.error('Failed to get page:', error);
      throw error;
    }

    try {
      const html = this.generatePackingSlipHtml(packingSlipData);

      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      const pdf = await page.pdf({
        format: 'letter',
        margin: {
          top: '0',
          right: '0',
          bottom: '0',
          left: '0',
        },
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

  private generatePackingSlipHtml(data: any): string {
    const content = this.generatePackingSlipContent(data);
    return this.cachedBaseTemplate.replace('{{CONTENT}}', content);
  }

  private generatePackingSlipContent(data: any): string {
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'pending':
          return 'bg-yellow-100 text-yellow-800';
        case 'processing':
          return 'bg-blue-100 text-blue-800';
        case 'shipped':
          return 'bg-green-100 text-green-800';
        case 'delivered':
          return 'bg-purple-100 text-purple-800';
        default:
          return 'bg-gray-100 text-gray-800';
      }
    };

    return `
      <!-- Top shipping address line and PACKING LIST -->
      <div class="mb-6">
        <div class="flex items-end justify-between border-b border-black pb-2">
          <div class="text-sm text-black">
            2450 Meadowbrook Pkwy Duluth, GA 30096, Phone: 877-415-7323
          </div>
          <h1 class="text-3xl font-bold text-black">PACKING LIST</h1>
        </div>
      </div>

      <!-- Job Numbers -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-4">
          <div class="text-left">
            <p class="text-sm text-gray-700">Job No: 205544 - HH Global</p>
          </div>
        </div>
      </div>

      <!-- Ship To Information -->
      <div class="mb-8">
        <div>
          <h3 class="text-md font-bold text-black mb-3">Ship To:</h3>
          <div class="text-sm text-gray-800">
            <p class="font-medium">${data.order.customer.name}</p>
            <p>${data.order.customer.shippingAddress.street}</p>
            <p>${data.order.customer.shippingAddress.city}, ${data.order.customer.shippingAddress.state} ${data.order.customer.shippingAddress.zipCode}</p>
            <p>${data.order.customer.shippingAddress.country}</p>
            <p>${data.order.customer.email}</p>
          </div>
        </div>
      </div>

      <!-- Order Details -->
      <div class="mb-8">
        <h3 class="text-md font-bold text-black mb-4">ORDER DETAILS</h3>
        
        <div class="overflow-x-auto">
          <table class="w-full border-collapse border border-black">
            <thead>
              <tr class="bg-gray-200">
                <th class="border border-black px-4 py-2 text-left text-sm font-bold text-black">Description</th>
                <th class="border border-black px-4 py-2 text-center text-sm font-bold text-black">Qty Ordered</th>
              </tr>
            </thead>
            <tbody>
              ${data.order.items
                .map(
                  (item, index) => `
                <tr class="${index % 2 === 1 ? 'bg-gray-50' : ''}">
                  <td class="border border-black px-4 py-2 text-sm text-black">${item.description}</td>
                  <td class="border border-black px-4 py-2 text-center text-sm text-black font-medium">${item.quantity}</td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
        
        <div class="mt-4 text-sm text-gray-700">
          <p><strong>Total Items:</strong> ${data.order.items.length}</p>
          <p><strong>Total Quantity:</strong> ${data.order.items.reduce((sum, item) => sum + item.quantity, 0)}</p>
        </div>
      </div>

      <!-- Footer -->
      <div class="mt-8 pt-6 border-t border-gray-400">
        <div class="flex justify-between items-center text-sm text-gray-600">
          <div>
            <p>Generated on: ${formatDate(data.generatedDate)}</p>
            <p>Job Number: 205544 - HH Global</p>
          </div>
          <div class="text-right">
            <p>Please verify all items before shipping</p>
          </div>
        </div>
      </div>
    `;
  }
}
