import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConcurrencyService } from '../common/services/concurrency.service';

@Injectable()
export class FileBasedPdfService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FileBasedPdfService.name);
  private browserPromise: Promise<puppeteer.Browser>;
  private cachedBaseTemplate: string;
  private cachedStyles: string;

  constructor(private readonly concurrencyService: ConcurrencyService) {}

  async onModuleInit() {
    // Launch persistent browser with optimized args
    this.browserPromise = puppeteer.launch({
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
        '--memory-pressure-off'
      ]
    });

    // Pre-compile templates and cache styles
    this.precompileTemplates();
    this.logger.log('File-based PDF service initialized');
  }

  async onModuleDestroy() {
    const browser = await this.browserPromise;
    await browser.close();
    this.logger.log('File-based PDF service destroyed');
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
    
    this.logger.log('Templates precompiled and cached');
  }

  async generateBatchPDFs(customerCode: string, kits: any[]): Promise<Buffer> {
    const sessionId = `${customerCode}-${Date.now()}`;
    const tempDir = path.join(os.tmpdir(), 'wg-packing-slips', sessionId);
    
    try {
      // Create temp directory
      await fs.promises.mkdir(tempDir, { recursive: true });
      this.logger.log(`Created temp directory: ${tempDir}`);

      // Generate PDFs concurrently with limiter
      const browser = await this.browserPromise;
      const limiter = this.concurrencyService.createLimiter(5);
      
      const promises = kits.map((kit, index) => 
        limiter.add(() => this.generateSinglePDF(browser, kit, tempDir, index))
      );

      const pdfFiles = await Promise.all(promises);
      this.logger.log(`Generated ${pdfFiles.length} PDFs`);

      // Merge PDFs
      const mergedPdfBuffer = await this.mergePDFs(pdfFiles);
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

  private async generateSinglePDF(
    browser: puppeteer.Browser,
    kit: any,
    tempDir: string,
    index: number
  ): Promise<string> {
    const page = await browser.newPage();
    
    try {
      // Set viewport
      await page.setViewport({
        width: 816,
        height: 1056,
        deviceScaleFactor: 1,
      });

      // Generate HTML content
      const html = this.generatePackingSlipHtml(kit);
      
      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'letter',
        margin: {
          top: '0',
          right: '0',
          bottom: '0',
          left: '0'
        },
        printBackground: true,
        preferCSSPageSize: true
      });

      // Save to temp file
      const filename = `${String(index).padStart(3, '0')}-${kit.id}.pdf`;
      const filepath = path.join(tempDir, filename);
      await fs.promises.writeFile(filepath, pdfBuffer);

      return filepath;
    } finally {
      await page.close();
    }
  }

  private async mergePDFs(pdfFilePaths: string[]): Promise<Buffer> {
    const { PDFDocument } = await import('pdf-lib');
    const mergedPdf = await PDFDocument.create();

    // Sort files to ensure consistent order
    const sortedFiles = pdfFilePaths.sort();

    for (const filePath of sortedFiles) {
      const pdfBytes = await fs.promises.readFile(filePath);
      const pdf = await PDFDocument.load(pdfBytes);
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      pages.forEach(page => mergedPdf.addPage(page));
    }

    const mergedPdfBytes = await mergedPdf.save();
    return Buffer.from(mergedPdfBytes);
  }

  private generatePackingSlipHtml(kit: any): string {
    const content = this.generatePackingSlipContent(kit);
    return this.cachedBaseTemplate.replace('{{CONTENT}}', content);
  }

  private generatePackingSlipContent(kit: any): string {
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
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
            <p class="font-medium">${kit.recipient.name}</p>
            <p>${kit.recipient.address.street}</p>
            <p>${kit.recipient.address.city}, ${kit.recipient.address.state} ${kit.recipient.address.zipCode}</p>
            <p>${kit.recipient.address.country || 'USA'}</p>
            <p>${kit.recipient.email}</p>
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
              ${kit.items.map((item, index) => `
                <tr class="${index % 2 === 1 ? 'bg-gray-50' : ''}">
                  <td class="border border-black px-4 py-2 text-sm text-black">${item.description}</td>
                  <td class="border border-black px-4 py-2 text-center text-sm text-black font-medium">${item.quantity}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <div class="mt-4 text-sm text-gray-700">
          <p><strong>Total Items:</strong> ${kit.items.length}</p>
          <p><strong>Total Quantity:</strong> ${kit.items.reduce((sum, item) => sum + item.quantity, 0)}</p>
        </div>
      </div>

      ${kit.metadata.specialInstructions ? `
        <div class="mb-6 p-4 bg-gray-50 border border-gray-300">
          <h4 class="text-sm font-medium text-gray-800 mb-2">Special Instructions:</h4>
          <p class="text-sm text-gray-700">${kit.metadata.specialInstructions.join('<br>')}</p>
        </div>
      ` : ''}

      <!-- Footer -->
      <div class="mt-8 pt-6 border-t border-gray-400">
        <div class="flex justify-between items-center text-sm text-gray-600">
          <div>
            <p>Generated on: ${formatDate(new Date().toISOString())}</p>
            <p>Kit ID: ${kit.id}</p>
          </div>
          <div class="text-right">
            <p>Please verify all items before shipping</p>
          </div>
        </div>
      </div>
    `;
  }
}