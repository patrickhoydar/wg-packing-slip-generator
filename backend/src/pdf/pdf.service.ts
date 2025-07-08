import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';

@Injectable()
export class PdfService {
  async generatePackingSlipPdf(packingSlipData: any): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      
      // Set viewport to match our design
      await page.setViewport({
        width: 816, // 8.5 inches at 96 DPI
        height: 1056, // 11 inches at 96 DPI
        deviceScaleFactor: 1,
      });

      // Generate HTML content for the packing slip
      const html = this.generatePackingSlipHtml(packingSlipData);
      
      await page.setContent(html, {
        waitUntil: 'networkidle0'
      });

      // Generate PDF with exact same styling as print
      const pdf = await page.pdf({
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

      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private generatePackingSlipHtml(data: any): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Packing Slip</title>
          <script src="https://cdn.tailwindcss.com"></script>
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
        </head>
        <body>
          <div class="packing-slip-container">
            <div class="packing-slip-content">
              ${this.generatePackingSlipContent(data)}
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private generatePackingSlipContent(data: any): string {
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'pending': return 'bg-yellow-100 text-yellow-800';
        case 'processing': return 'bg-blue-100 text-blue-800';
        case 'shipped': return 'bg-green-100 text-green-800';
        case 'delivered': return 'bg-purple-100 text-purple-800';
        default: return 'bg-gray-100 text-gray-800';
      }
    };

    return `
      <!-- Company Header -->
      <header class="mb-8 border-b-2 border-gray-200 pb-4">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">${data.company.name}</h1>
            <div class="mt-2 text-sm text-gray-600">
              <p>${data.company.address.street}</p>
              <p>${data.company.address.city}, ${data.company.address.state} ${data.company.address.zipCode}</p>
              <p>${data.company.address.country}</p>
            </div>
          </div>
          <div class="text-right text-sm text-gray-600">
            <p>Phone: ${data.company.phone}</p>
            <p>Email: ${data.company.email}</p>
            <p>Web: ${data.company.website}</p>
          </div>
        </div>
      </header>

      <!-- Order Header -->
      <div class="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-2xl font-bold text-gray-900">Packing Slip</h2>
          <span class="px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(data.order.status)}">
            ${data.order.status.toUpperCase()}
          </span>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p class="text-sm text-gray-600">Order Number</p>
            <p class="text-lg font-semibold text-gray-900">${data.order.orderNumber}</p>
          </div>
          <div>
            <p class="text-sm text-gray-600">Order Date</p>
            <p class="text-lg font-semibold text-gray-900">${formatDate(data.order.orderDate)}</p>
          </div>
          <div>
            <p class="text-sm text-gray-600">Shipping Date</p>
            <p class="text-lg font-semibold text-gray-900">${formatDate(data.order.shippingDate)}</p>
          </div>
        </div>
      </div>

      <!-- Customer Information -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div class="bg-gray-50 p-4 rounded-lg">
          <h3 class="text-lg font-semibold text-gray-900 mb-3">Billing Address</h3>
          <div class="text-sm text-gray-700">
            <p class="font-medium">${data.order.customer.name}</p>
            <p>${data.order.customer.billingAddress.street}</p>
            <p>${data.order.customer.billingAddress.city}, ${data.order.customer.billingAddress.state} ${data.order.customer.billingAddress.zipCode}</p>
            <p>${data.order.customer.billingAddress.country}</p>
            <div class="mt-2 pt-2 border-t border-gray-200">
              <p>Phone: ${data.order.customer.phone}</p>
              <p>Email: ${data.order.customer.email}</p>
            </div>
          </div>
        </div>

        <div class="bg-gray-50 p-4 rounded-lg">
          <h3 class="text-lg font-semibold text-gray-900 mb-3">Shipping Address</h3>
          <div class="text-sm text-gray-700">
            <p class="font-medium">${data.order.customer.name}</p>
            <p>${data.order.customer.shippingAddress.street}</p>
            <p>${data.order.customer.shippingAddress.city}, ${data.order.customer.shippingAddress.state} ${data.order.customer.shippingAddress.zipCode}</p>
            <p>${data.order.customer.shippingAddress.country}</p>
          </div>
        </div>
      </div>

      <!-- Items List -->
      <div class="mb-8">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Items to Ship</h3>
        
        <div class="overflow-x-auto">
          <table class="w-full border-collapse border border-gray-300">
            <thead>
              <tr class="bg-gray-50">
                <th class="border border-gray-300 px-4 py-2 text-left text-sm font-medium text-gray-900">SKU</th>
                <th class="border border-gray-300 px-4 py-2 text-left text-sm font-medium text-gray-900">Item</th>
                <th class="border border-gray-300 px-4 py-2 text-left text-sm font-medium text-gray-900">Description</th>
                <th class="border border-gray-300 px-4 py-2 text-center text-sm font-medium text-gray-900">Quantity</th>
              </tr>
            </thead>
            <tbody>
              ${data.order.items.map(item => `
                <tr class="hover:bg-gray-50">
                  <td class="border border-gray-300 px-4 py-2 text-sm text-gray-900 font-mono">${item.sku}</td>
                  <td class="border border-gray-300 px-4 py-2 text-sm text-gray-900 font-medium">${item.name}</td>
                  <td class="border border-gray-300 px-4 py-2 text-sm text-gray-700">${item.description}</td>
                  <td class="border border-gray-300 px-4 py-2 text-center text-sm text-gray-900 font-medium">${item.quantity}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <div class="mt-4 text-sm text-gray-600">
          <p>Total Items: ${data.order.items.length}</p>
          <p>Total Quantity: ${data.order.items.reduce((sum, item) => sum + item.quantity, 0)}</p>
        </div>
      </div>

      ${data.notes ? `
        <div class="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 class="text-sm font-medium text-yellow-800 mb-2">Special Instructions:</h4>
          <p class="text-sm text-yellow-700">${data.notes}</p>
        </div>
      ` : ''}

      <!-- Footer -->
      <div class="mt-8 pt-6 border-t border-gray-200">
        <div class="flex justify-between items-center text-sm text-gray-600">
          <div>
            <p>Generated on: ${formatDate(data.generatedDate)}</p>
            <p>Packing Slip ID: ${data.id}</p>
          </div>
          <div class="text-right">
            <p>Please verify all items before shipping</p>
            <p>Contact us at ${data.company.email} for any questions</p>
          </div>
        </div>
      </div>
    `;
  }
}