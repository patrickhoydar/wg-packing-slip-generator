import { Injectable, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { CustomerStrategyFactory } from './strategies/base/customer-strategy.factory';
import { HHGlobalStrategy } from './strategies/hh-global/hh-global.strategy';
import { GeorgiaBaptistStrategy } from './strategies/georgia-baptist/georgia-baptist.strategy';
import { InquirEDStrategy } from './strategies/inquired/inquired.strategy';
import { PdfService } from '../pdf/pdf.service';
import { PaceService } from '../pace/pace.service';
import { CreateJobShipmentResponse } from '../pace/interfaces/pace.interface';
import { PrismaService } from '../prisma/prisma.service';
import { ShipmentsService } from '../shipments/shipments.service';
import { JobsService } from '../jobs/jobs.service';
import { Job, Customer, Shipment } from '@prisma/client';
import * as JSZip from 'jszip';
import * as path from 'path';
import * as os from 'os';

@Injectable()
export class CustomersService implements OnModuleInit {
  constructor(
    private readonly strategyFactory: CustomerStrategyFactory,
    private readonly hhGlobalStrategy: HHGlobalStrategy,
    private readonly georgiaBaptistStrategy: GeorgiaBaptistStrategy,
    private readonly inquirEDStrategy: InquirEDStrategy,
    private readonly pdfService: PdfService,
    private readonly paceService: PaceService,
    private readonly prisma: PrismaService,
    private readonly shipmentsService: ShipmentsService,
    @Inject(forwardRef(() => JobsService))
    private readonly jobsService: JobsService,
  ) {}

  onModuleInit() {
    // Register all available strategies
    this.strategyFactory.registerStrategy('HH_GLOBAL', this.hhGlobalStrategy);
    this.strategyFactory.registerStrategy(
      'GEORGIA_BAPTIST',
      this.georgiaBaptistStrategy,
    );
    this.strategyFactory.registerStrategy('INQUIRED', this.inquirEDStrategy);
  }

  async getAvailableStrategies() {
    return this.strategyFactory.getAllStrategies();
  }

  async getAllCustomers() {
    return this.prisma.customer.findMany({
      select: {
        id: true,
        customerCode: true,
        displayName: true,
        defaultShipVia: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getCustomerByCode(customerCode: string) {
    return this.prisma.customer.findUnique({
      where: {
        customerCode: customerCode.toUpperCase(),
      },
    });
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
    const result = await strategy.processFile(fileBuffer, filename, jobNumber);

    // If jobNumber is provided, check for existing job and merge ERP shipment IDs
    if (jobNumber && result.kits.length > 0) {
      console.log(`[ERP-MERGE] Checking for existing job: ${jobNumber}`);

      // Get customer by customer code
      const customer = await this.getCustomerByCode(customerCode);
      if (customer) {
        // Check if job already exists
        const existingJob = await this.jobsService.findByJobNumber(
          customer.id,
          jobNumber,
        );

        if (existingJob && (existingJob as any).shipments) {
          const shipments = (existingJob as any).shipments;
          console.log(
            `[ERP-MERGE] Found existing job with ${shipments.length} shipments`,
          );

          // Merge ERP shipment IDs into kits
          result.kits = this.mergeErpShipmentIds(result.kits, shipments);
        } else {
          console.log(
            `[ERP-MERGE] No existing job found for job number: ${jobNumber}`,
          );
        }
      } else {
        console.log(`[ERP-MERGE] Customer not found for code: ${customerCode}`);
      }
    }

    return result;
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

  // New chunked batch generation with local directory storage
  async generateBatchPDFsToDirectory(
    customerCode: string,
    kits: any[],
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
    console.log(
      `[BATCH] Starting NEW chunked batch PDF generation for ${kits.length} kits in chunks of ${chunkSize}`,
    );

    // Create a unique output directory
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .split('.')[0];
    const sessionId = `${customerCode}-${timestamp}`;

    // Use a dedicated directory for packing slips in the current working directory
    const outputDir = path.join(
      process.cwd(),
      'generated-packing-slips',
      sessionId,
    );

    console.log(`[BATCH] PDFs will be saved to: ${outputDir}`);
    console.log(
      `[BATCH] Expected output: ~${Math.ceil(kits.length / chunkSize)} chunks with up to ${chunkSize} PDFs each`,
    );

    const startTime = Date.now();

    // Use the new chunked PDF service method
    const result = await this.pdfService.generateBatchPDFsToDirectory(
      customerCode,
      kits,
      outputDir,
      chunkSize,
    );

    const totalDuration = Math.round((Date.now() - startTime) / 1000);
    const successRate = Math.round((result.totalGenerated / kits.length) * 100);

    console.log(
      `[BATCH] Chunked generation completed in ${totalDuration}s: ${result.totalGenerated}/${kits.length} PDFs generated (${successRate}% success rate)`,
    );
    console.log(`[BATCH] PDFs saved to directory: ${result.outputDirectory}`);

    if (result.totalGenerated < kits.length) {
      console.warn(
        `[BATCH] WARNING: ${kits.length - result.totalGenerated} PDFs failed to generate. Check logs for details.`,
      );
    }

    return result;
  }

  async generateBatchPDFs(customerCode: string, kits: any[]): Promise<Buffer> {
    console.log(
      `[OLD] Starting OLD batch PDF generation for ${kits.length} kits`,
    );

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

    // Debug logging to see what's in the kit
    console.log('[PREVIEW-DEBUG] Kit data received');

    // For preview purposes, generate fallback values if not present
    const jobNumber = kit.jobNumber || 'PREVIEW-JOB';
    const shipmentId = kit.shipmentId || `${jobNumber}-0001`;

    // Apply customer-specific template customization and shipping rules
    const branding = strategy.customizeTemplate(kit);
    const shippingRules = strategy.getShippingRules(kit);

    // Convert to the same format used by PDF service
    const deliveryInfo = kit.metadata?.customFields?.deliveryInfo;
    const shippingMethod = shippingRules.method; // Use shipping method from strategy instead of old logic

    const previewData = {
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
            country: kit.recipient.address.country || 'US',
          },
        },
        items: kit.items,
      },
      jobNumber: jobNumber,
      shipmentInfo: {
        shipmentId: shipmentId,
        erpShipmentId: kit.erpShipmentId || shipmentId, // Use erpShipmentId if available, fallback to shipmentId
        erpSystem: kit.erpSystem || '',
      },
      shipTo: {
        name: kit.recipient.name,
        company: kit.recipient.company,
        email: kit.recipient.email,
        phone: kit.recipient.phone,
        address: {
          street: kit.recipient.address.street,
          city: kit.recipient.address.city,
          state: kit.recipient.address.state,
          zipCode: kit.recipient.address.zipCode,
          country: kit.recipient.address.country || 'US',
        },
      },
      items: kit.items,
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
      // CRITICAL: Pass through the entire kit object so template has access to metadata
      metadata: kit.metadata || null,
    };

    return previewData;
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
          phone: kit.recipient.phone,
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

  /**
   * Create PACE shipment for InquirED kit
   */
  async createPaceShipmentForKit(
    customerCode: string,
    kit: any,
    jobNumber: string,
  ): Promise<CreateJobShipmentResponse> {
    if (customerCode.toUpperCase() !== 'INQUIRED') {
      return {
        success: false,
        message:
          'PACE integration is currently only supported for InquirED customers',
        errors: ['Unsupported customer code for PACE integration'],
      };
    }

    try {
      // Use the InquirED strategy to transform kit data to PACE format
      const pacePayload = this.inquirEDStrategy.transformKitToPaceShipment(
        kit,
        jobNumber,
      );

      const result = await this.paceService.createJobShipment(pacePayload);

      // Find the database shipment record that corresponds to this kit
      const shipment = await this.prisma.shipment.findFirst({
        where: {
          kitData: {
            path: ['id'],
            equals: kit.id,
          },
        },
      });

      if (shipment && result.success && result.shipmentId) {
        // Update the shipment record with PACE ERP info
        await this.shipmentsService.updateErpInfo(
          shipment.id,
          result.shipmentId.toString(),
          'PACE',
          result.response,
        );
      }

      // Update the job contact
      const jobContact = await this.paceService.updateJobContact(
        result.response,
        kit,
      );

      return { ...result, jobContact };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to create PACE shipment: ${error.message}`,
        errors: [error.message],
      };
    }
  }

  /**
   * Create PACE shipments for multiple InquirED kits
   */
  async createPaceShipmentsForKits(
    customerCode: string,
    kits: any[],
    jobNumber: string,
  ): Promise<{
    results: Array<{ kitId: string; result: CreateJobShipmentResponse }>;
    summary: { total: number; successful: number; failed: number };
  }> {
    const results: Array<{ kitId: string; result: CreateJobShipmentResponse }> =
      [];
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < kits.length; i++) {
      const kit = kits[i];
      const jobNumberId = `${jobNumber}`;

      try {
        const result = await this.createPaceShipmentForKit(
          customerCode,
          kit,
          jobNumberId,
        );
        results.push({ kitId: kit.id, result });

        if (result.success) {
          successful++;
        } else {
          failed++;
        }
      } catch (error: any) {
        results.push({
          kitId: kit.id,
          result: {
            success: false,
            message: `Error processing kit: ${error.message}`,
            errors: [error.message],
          },
        });
        failed++;
      }
    }

    return {
      results,
      summary: {
        total: kits.length,
        successful,
        failed,
      },
    };
  }

  async createMergedPdfFromDirectory(directoryPath: string): Promise<Buffer> {
    return await this.pdfService.createMergedPdfFromDirectory(directoryPath);
  }

  /**
   * Merge ERP shipment IDs from existing shipments into new kits
   * Matches based on shipmentId from kit and kitData stored in shipment
   */
  private mergeErpShipmentIds(kits: any[], shipments: any[]): any[] {
    console.log(
      `[ERP-MERGE] Attempting to merge ${shipments.length} shipments with ${kits.length} kits`,
    );

    const updatedKits = kits.map((kit) => {
      // Find matching shipment by checking if the kit's shipmentId matches the one stored in shipment's kitData
      const matchingShipment = shipments.find((shipment) => {
        try {
          const kitData = shipment.kitData;

          if (kitData?.shipmentId === kit.shipmentId) {
            return true;
          }
          // Fallback: match by kit ID
          if (kitData?.id === kit.id) {
            console.log(`[ERP-MERGE] ✅ Matched by kit ID: ${kit.id}`);
            return true;
          }
          return false;
        } catch (error) {
          console.warn(
            `[ERP-MERGE] Error parsing kitData for shipment ${shipment.id}:`,
            error,
          );
          return false;
        }
      });

      if (matchingShipment && matchingShipment.erpShipmentId) {
        console.log(
          `[ERP-MERGE] Matched kit ${kit.id} with ERP shipment ID: ${matchingShipment.erpShipmentId}`,
        );
        return {
          ...kit,
          erpShipmentId: matchingShipment.erpShipmentId,
        };
      }

      return kit;
    });

    const mergedCount = updatedKits.filter((kit) => kit.erpShipmentId).length;
    console.log(
      `[ERP-MERGE] Successfully merged ${mergedCount}/${kits.length} kits with ERP shipment IDs`,
    );

    return updatedKits;
  }
}
