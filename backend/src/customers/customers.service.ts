import { Injectable, OnModuleInit } from '@nestjs/common';
import { CustomerStrategyFactory } from './strategies/base/customer-strategy.factory';
import { HHGlobalStrategy } from './strategies/hh-global/hh-global.strategy';
import { PdfService } from '../pdf/pdf.service';
import * as JSZip from 'jszip';

@Injectable()
export class CustomersService implements OnModuleInit {
  constructor(
    private readonly strategyFactory: CustomerStrategyFactory,
    private readonly hhGlobalStrategy: HHGlobalStrategy,
    private readonly pdfService: PdfService
  ) {}

  onModuleInit() {
    // Register all available strategies
    this.strategyFactory.registerStrategy('HH_GLOBAL', this.hhGlobalStrategy);
  }

  async getAvailableStrategies() {
    return this.strategyFactory.getAllStrategies();
  }

  async getUploadInstructions(customerCode: string) {
    const strategy = this.strategyFactory.getStrategy(customerCode);
    return {
      customerCode: strategy.customerCode,
      displayName: strategy.displayName,
      instructions: strategy.getFileUploadInstructions()
    };
  }

  async processFile(customerCode: string, fileBuffer: Buffer, filename: string) {
    const strategy = this.strategyFactory.getStrategy(customerCode);
    return await strategy.processFile(fileBuffer, filename);
  }

  async validateFile(customerCode: string, fileBuffer: Buffer, filename: string) {
    const strategy = this.strategyFactory.getStrategy(customerCode);
    const parsedData = await strategy.parseFile(fileBuffer, filename);
    return await strategy.validateData(parsedData);
  }

  async generateBatchPDFs(customerCode: string, kits: any[]): Promise<Buffer> {
    const strategy = this.strategyFactory.getStrategy(customerCode);
    const zip = new JSZip();

    for (let i = 0; i < kits.length; i++) {
      const kit = kits[i];
      
      // Apply customer-specific template customization
      const branding = strategy.customizeTemplate(kit);
      const shippingRules = strategy.getShippingRules(kit);
      
      // Convert kit to packing slip format
      const packingSlipData = this.convertKitToPackingSlip(kit, branding, shippingRules);
      
      // Generate PDF for this kit
      const pdfBuffer = await this.pdfService.generatePackingSlipPdf(packingSlipData);
      
      // Add to zip with descriptive filename
      const filename = `${kit.id}-${kit.recipient.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      zip.file(filename, pdfBuffer);
    }

    // Generate the zip file
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    return zipBuffer;
  }

  private convertKitToPackingSlip(kit: any, branding: any, shippingRules: any) {
    // Convert customer kit format to our standard packing slip format
    return {
      id: kit.id,
      generatedDate: new Date().toISOString().split('T')[0],
      notes: shippingRules.instructions?.join('\n'),
      company: {
        name: branding.shouldOverrideCompany ? branding.companyName : 'Wallace Graphics',
        address: {
          street: '123 Business Ave',
          city: 'Business City', 
          state: 'NY',
          zipCode: '12345',
          country: 'USA'
        },
        phone: '(555) 123-4567',
        email: 'orders@wallacegraphics.com',
        website: 'www.wallacegraphics.com'
      },
      order: {
        id: kit.id,
        orderNumber: kit.id,
        orderDate: new Date().toISOString().split('T')[0],
        shippingDate: new Date().toISOString().split('T')[0],
        status: 'processing',
        customer: {
          id: kit.recipient.email,
          name: kit.recipient.name,
          email: kit.recipient.email,
          phone: '',
          billingAddress: kit.recipient.address,
          shippingAddress: kit.recipient.address
        },
        items: kit.items.map((item, index) => ({
          id: item.id,
          sku: item.sku,
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unitPrice: 0,
          totalPrice: 0
        })),
        subtotal: 0,
        tax: 0,
        shipping: 0,
        total: 0
      }
    };
  }
}