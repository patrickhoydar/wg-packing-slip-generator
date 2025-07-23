import { Injectable, OnModuleInit } from '@nestjs/common';
import { CustomerStrategyFactory } from './strategies/base/customer-strategy.factory';
import { HHGlobalStrategy } from './strategies/hh-global/hh-global.strategy';
import { GeorgiaBaptistStrategy } from './strategies/georgia-baptist/georgia-baptist.strategy';
import { InquirEDStrategy } from './strategies/inquire-ed/inquire-ed.strategy';
import { PdfService } from '../pdf/pdf.service';
import * as JSZip from 'jszip';

@Injectable()
export class CustomersService implements OnModuleInit {
  constructor(
    private readonly strategyFactory: CustomerStrategyFactory,
    private readonly hhGlobalStrategy: HHGlobalStrategy,
    private readonly georgiaBaptistStrategy: GeorgiaBaptistStrategy,
    private readonly inquirEDStrategy: InquirEDStrategy,
    private readonly pdfService: PdfService,
  ) {}

  onModuleInit() {
    // Register all available strategies
    this.strategyFactory.registerStrategy('HH_GLOBAL', this.hhGlobalStrategy);
    this.strategyFactory.registerStrategy(
      'GEORGIA_BAPTIST',
      this.georgiaBaptistStrategy,
    );
    this.strategyFactory.registerStrategy('INQUIRE_ED', this.inquirEDStrategy);
  }

  async getAvailableStrategies() {
    return this.strategyFactory.getAllStrategies();
  }

  async getUploadInstructions(customerCode: string) {
    const strategy = this.strategyFactory.getStrategy(customerCode);
    return {
      customerCode: strategy.customerCode,
      displayName: strategy.displayName,
      instructions: strategy.getFileUploadInstructions(),
    };
  }

  async processFile(
    customerCode: string,
    fileBuffer: Buffer,
    filename: string,
    jobNumber?: string,
  ) {
    const strategy = this.strategyFactory.getStrategy(customerCode);
    return await strategy.processFile(fileBuffer, filename, jobNumber);
  }

  async validateFile(
    customerCode: string,
    fileBuffer: Buffer,
    filename: string,
  ) {
    const strategy = this.strategyFactory.getStrategy(customerCode);
    const parsedData = await strategy.parseFile(fileBuffer, filename);
    return await strategy.validateData(parsedData);
  }

  async generateBatchPDFs(customerCode: string, kits: any[]): Promise<Buffer> {
    console.log(`Starting batch PDF generation for ${kits.length} kits`);

    // Use the consolidated PDF service for batch generation
    const mergedPdfBuffer = await this.pdfService.generateBatchPDFs(
      customerCode,
      kits,
    );

    console.log(
      `Generated merged PDF with size: ${mergedPdfBuffer.length} bytes`,
    );
    return mergedPdfBuffer;
  }

  // Legacy method - keep for potential fallback
  async generateBatchPDFsLegacy(
    customerCode: string,
    kits: any[],
  ): Promise<Buffer> {
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
      const packingSlipData = this.convertKitToPackingSlip(
        kit,
        branding,
        shippingRules,
      );

      // Generate PDF for this kit
      const pdfBuffer =
        await this.pdfService.generatePackingSlipPdf(packingSlipData);

      // Add to zip with descriptive filename
      const filename = `${kit.id}-${kit.recipient.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      zip.file(filename, pdfBuffer);
      console.log(`Added PDF to zip: ${filename}`);
    }

    // Generate the zip file
    console.log(
      `Generating ZIP file with ${Object.keys(zip.files).length} PDFs`,
    );
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    console.log(`Generated ZIP file with size: ${zipBuffer.length} bytes`);
    return zipBuffer;
  }

  async generatePreviewData(customerCode: string, kit: any) {
    const strategy = this.strategyFactory.getStrategy(customerCode);

    // Apply customer-specific template customization and shipping rules
    const branding = strategy.customizeTemplate(kit);
    const shippingRules = strategy.getShippingRules(kit);

    // Convert to the same format used by PDF service
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
            country: kit.recipient.address.country || 'US',
          },
        },
        items: kit.items,
      },
      jobNumber: kit.jobNumber || '',
      specialInstructions: kit.metadata?.specialInstructions || '',
      generatedDate: new Date().toISOString(),
      orderType: kit.metadata?.customFields?.fileType || 'pm',
      deliveryInfo: deliveryInfo || null,
      shippingMethod: shippingMethod,
      // Add summary data
      summary: {
        totalItems: kit.items?.length || 0,
        totalQuantity:
          kit.items?.reduce(
            (sum: number, item: any) => sum + item.quantity,
            0,
          ) || 0,
      },
    };
  }

  private calculateShippingMethod(deliveryInfo: any): string {
    if (!deliveryInfo) {
      return 'Standard Ground';
    }

    // InquirED shipping logic based on Dock and Paved Path columns
    if (deliveryInfo.hasDock) {
      return 'Standard LTL Shipment';
    } else if (deliveryInfo.hasPavedPath) {
      return 'LTL Shipment with lift gate & inside delivery';
    } else {
      return 'LTL Shipment with white glove service';
    }
  }

  private convertKitToPackingSlip(kit: any, branding: any, shippingRules: any) {
    // Convert customer kit format to our standard packing slip format
    return {
      id: kit.id,
      generatedDate: new Date().toISOString().split('T')[0],
      notes: shippingRules.instructions?.join('\n'),
      company: {
        name: branding.shouldOverrideCompany
          ? branding.companyName
          : 'Wallace Graphics',
        address: {
          street: '123 Business Ave',
          city: 'Business City',
          state: 'NY',
          zipCode: '12345',
          country: 'US',
        },
        phone: '(555) 123-4567',
        email: 'orders@wallacegraphics.com',
        website: 'www.wallacegraphics.com',
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
          shippingAddress: kit.recipient.address,
        },
        items: kit.items.map((item, index) => ({
          id: item.id,
          sku: item.sku,
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unitPrice: 0,
          totalPrice: 0,
        })),
        subtotal: 0,
        tax: 0,
        shipping: 0,
        total: 0,
      },
    };
  }
}
