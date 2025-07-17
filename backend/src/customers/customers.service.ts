import { Injectable, OnModuleInit } from '@nestjs/common';
import { CustomerStrategyFactory } from './strategies/base/customer-strategy.factory';
import { HHGlobalStrategy } from './strategies/hh-global/hh-global.strategy';
import { GeorgiaBaptistStrategy } from './strategies/georgia-baptist/georgia-baptist.strategy';
import { InquireEdStrategy } from './strategies/inquire-ed/inquire-ed.strategy';
import { PdfService } from '../pdf/pdf.service';
import { FileBasedPdfService } from '../pdf/file-based-pdf.service';
import * as JSZip from 'jszip';

@Injectable()
export class CustomersService implements OnModuleInit {
  constructor(
    private readonly strategyFactory: CustomerStrategyFactory,
    private readonly hhGlobalStrategy: HHGlobalStrategy,
    private readonly georgiaBaptistStrategy: GeorgiaBaptistStrategy,
    private readonly inquireEdStrategy: InquireEdStrategy,
    private readonly pdfService: PdfService,
    private readonly fileBasedPdfService: FileBasedPdfService
  ) {}

  onModuleInit() {
    // Register all available strategies
    this.strategyFactory.registerStrategy('HH_GLOBAL', this.hhGlobalStrategy);
    this.strategyFactory.registerStrategy('GEORGIA_BAPTIST', this.georgiaBaptistStrategy);
    this.strategyFactory.registerStrategy('INQUIRE_ED', this.inquireEdStrategy);
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
    console.log(`Starting file-based batch PDF generation for ${kits.length} kits`);
    
    // Use the new file-based PDF service for better performance
    const mergedPdfBuffer = await this.fileBasedPdfService.generateBatchPDFs(customerCode, kits);
    
    console.log(`Generated merged PDF with size: ${mergedPdfBuffer.length} bytes`);
    return mergedPdfBuffer;
  }

  // Legacy method - keep for potential fallback
  async generateBatchPDFsLegacy(customerCode: string, kits: any[]): Promise<Buffer> {
    console.log(`Starting legacy batch PDF generation for ${kits.length} kits`);
    const strategy = this.strategyFactory.getStrategy(customerCode);
    const zip = new JSZip();

    for (let i = 0; i < kits.length; i++) {
      const kit = kits[i];
      console.log(`Processing kit ${i + 1}/${kits.length}: ${kit.id}`);
      
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
      console.log(`Added PDF to zip: ${filename}`);
    }

    // Generate the zip file
    console.log(`Generating ZIP file with ${Object.keys(zip.files).length} PDFs`);
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    console.log(`Generated ZIP file with size: ${zipBuffer.length} bytes`);
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
          id: kit.recipient.email || kit.id,
          name: kit.recipient.name,
          company: kit.recipient.company,
          email: kit.recipient.email,
          phone: '',
          billingAddress: kit.billing?.address || kit.recipient.address,
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