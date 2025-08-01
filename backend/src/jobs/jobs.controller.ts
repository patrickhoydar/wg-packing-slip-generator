import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { ShipmentsService } from '../shipments/shipments.service';
import { ErpServiceFactory } from '../erp/erp-service.factory';
import { PrismaService } from '../prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { JobStatus } from '@prisma/client';

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly shipmentsService: ShipmentsService,
    private readonly erpServiceFactory: ErpServiceFactory,
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
  ) {}

  @Post('create')
  async createJob(
    @Body()
    body: {
      jobNumber: string;
      customerId: string;
      customerCode: string;
      kits: any[];
      uploadedFileName: string;
    },
  ) {
    const { jobNumber, customerId, customerCode, kits, uploadedFileName } =
      body;

    if (!jobNumber) {
      throw new BadRequestException('Job number is required');
    }
    if (!customerId) {
      throw new BadRequestException('Customer ID is required');
    }
    if (!customerCode) {
      throw new BadRequestException('Customer code is required');
    }
    if (!kits || !Array.isArray(kits) || kits.length === 0) {
      throw new BadRequestException(
        'Kits array is required and must not be empty',
      );
    }
    if (!uploadedFileName) {
      throw new BadRequestException('Uploaded file name is required');
    }

    // Check if job already exists for this customer
    const existingJob = await this.jobsService.findByJobNumber(
      customerId,
      jobNumber,
    );
    if (existingJob) {
      throw new BadRequestException(
        `Job number ${jobNumber} already exists for this customer`,
      );
    }

    const result = await this.jobsService.createJobWithShipments({
      jobNumber,
      customerId,
      uploadedFileName,
      kits,
    });

    return {
      success: true,
      message: `Created job ${jobNumber} with ${result.shipmentsCreated} shipments`,
      data: {
        job: result.job,
        shipmentsCreated: result.shipmentsCreated,
      },
    };
  }

  @Get(':id')
  async getJob(@Param('id') id: string) {
    const job = await this.jobsService.findById(id);
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const stats = await this.jobsService.getJobStats(id);
    return {
      ...job,
      stats,
    };
  }

  @Get(':id/shipments')
  async getJobShipments(
    @Param('id') id: string,
    @Query('status') status?: string,
  ) {
    const job = await this.jobsService.findById(id);
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const shipments = await this.shipmentsService.findByJobId(
      id,
      status as any,
    );

    return {
      jobId: id,
      total: shipments.length,
      shipments,
    };
  }

  @Post(':jobNumber/pace/create-shipments')
  async createPaceShipmentsByJobNumber(@Param('jobNumber') jobNumber: string) {
    // Find the job by job number (we'll need customer info, so we need to find across all customers)
    const jobs = await this.prisma.job.findMany({
      where: { jobNumber },
      include: {
        customer: true,
        shipments: {
          where: { status: 'pending' },
          include: { items: true },
        },
      },
    });

    if (jobs.length === 0) {
      throw new NotFoundException(`Job with number ${jobNumber} not found`);
    }

    if (jobs.length > 1) {
      throw new BadRequestException(
        `Multiple jobs found with number ${jobNumber}. Please specify customer.`,
      );
    }

    const job = jobs[0];
    const customerCode = job.customer.customerCode;

    // Check if this is an InquirED customer (PACE integration only supports InquirED)
    if (customerCode.toUpperCase() !== 'INQUIRED') {
      throw new BadRequestException(
        'PACE integration is currently only supported for InquirED customers',
      );
    }

    if (job.shipments.length === 0) {
      throw new BadRequestException(
        `No pending shipments found for job ${jobNumber}`,
      );
    }

    // Transform shipments to kits format for PACE creation
    const kits = job.shipments.map((shipment) => ({
      id: shipment.id,
      ...(shipment.kitData as any),
      items: shipment.items,
    }));

    // Use the customers service to create PACE shipments
    const result = await this.customersService.createPaceShipmentsForKits(
      customerCode,
      kits,
      jobNumber,
    );

    return {
      success: true,
      jobNumber,
      customerId: job.customerId,
      customerCode,
      message: `Processed ${result.summary.total} shipments for job ${jobNumber}`,
      summary: result.summary,
      results: result.results,
    };
  }

  @Post(':id/erp/create-shipments')
  async createErpShipments(@Param('id') id: string) {
    const job = await this.jobsService.findById(id);
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    // Check if ERP is enabled for this customer
    const erpSystem = this.erpServiceFactory.getErpSystemForCustomer(
      job.customer.customerCode,
    );
    if (!erpSystem) {
      throw new BadRequestException(
        'ERP integration not enabled for this customer',
      );
    }

    // Get ERP service
    const erpService = this.erpServiceFactory.getErpService(erpSystem);
    if (!erpService) {
      throw new BadRequestException(
        `ERP service not configured for ${erpSystem}`,
      );
    }

    // Update job status
    await this.jobsService.updateStatus(id, JobStatus.erp_creating);

    // Get pending shipments
    const pendingShipments =
      await this.shipmentsService.getPendingShipmentsByJob(id);

    if (pendingShipments.length === 0) {
      throw new BadRequestException('No pending shipments found');
    }

    const results: Array<{
      shipmentId: string;
      success: boolean;
      erpShipmentId?: string;
      message: string;
      errors?: string[];
    }> = [];
    let successCount = 0;
    let failedCount = 0;

    // Process each shipment
    for (const shipment of pendingShipments) {
      try {
        // Transform shipment to ERP request format
        const erpRequest = this.transformShipmentToErpRequest(
          shipment,
          job.jobNumber,
        );

        // Create shipment in ERP
        const erpResponse = await erpService.createShipment(erpRequest);

        if (erpResponse.success && erpResponse.shipmentId) {
          // Update shipment with ERP info
          await this.shipmentsService.updateErpInfo(
            shipment.id,
            erpResponse.shipmentId,
            erpSystem,
            erpResponse.response,
          );
          successCount++;
        } else {
          // Mark as failed
          await this.shipmentsService.updateStatus(shipment.id, 'failed');
          failedCount++;
        }

        results.push({
          shipmentId: shipment.id,
          success: erpResponse.success,
          erpShipmentId: erpResponse.shipmentId,
          message: erpResponse.message,
          errors: erpResponse.errors,
        });
      } catch (error: any) {
        // Mark as failed
        await this.shipmentsService.updateStatus(shipment.id, 'failed');
        failedCount++;

        results.push({
          shipmentId: shipment.id,
          success: false,
          message: error.message,
          errors: [error.message],
        });
      }
    }

    // Update job status
    const finalStatus =
      failedCount === 0 ? JobStatus.completed : JobStatus.failed;
    await this.jobsService.updateStatus(id, finalStatus);

    return {
      jobId: id,
      erpSystem,
      summary: {
        total: pendingShipments.length,
        successful: successCount,
        failed: failedCount,
      },
      results,
    };
  }

  @Post(':id/pdfs/generate')
  async generatePdfs(@Param('id') id: string) {
    const job = await this.jobsService.findById(id);
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    // Get shipments ready for PDF generation (with ERP IDs)
    const shipments =
      await this.shipmentsService.getShipmentsForPdfGeneration(id);

    if (shipments.length === 0) {
      throw new BadRequestException(
        'No shipments ready for PDF generation. Ensure ERP shipments are created first.',
      );
    }

    // This would integrate with your existing PDF generation service
    // For now, returning a placeholder response
    return {
      jobId: id,
      message: 'PDF generation initiated',
      shipmentsToProcess: shipments.length,
    };
  }

  private transformShipmentToErpRequest(shipment: any, jobNumber: string): any {
    // Extract kit data
    const kitData = shipment.kitData;

    // Calculate total quantity
    const totalQuantity = shipment.items.reduce(
      (sum: number, item: any) => sum + item.quantity,
      0,
    );

    return {
      job: jobNumber,
      shipmentType: 50, // Standard outbound
      shipVia: 1, // UPS Ground default
      quantity: totalQuantity,
      contactLastName: shipment.recipientName.split(' ').pop() || '',
      contactFirstName: shipment.recipientName.split(' ')[0] || '',
      email: kitData.recipient?.email || '',
      phone: kitData.recipient?.phone || '',
      address1: shipment.shippingAddress.street || '',
      address2: shipment.shippingAddress.street2 || '',
      zip: shipment.shippingAddress.zipCode || '',
      city: shipment.shippingAddress.city || '',
      country: 1, // US
      stateKey: `1:${shipment.shippingAddress.state || ''}`,
      dateTime: new Date().toISOString(),
      charges: 'Prepaid/Shipper',
      shipped: true,
      carton1Count: 1,
      count1: 1,
      carton1Quantity: totalQuantity,
      u_internalShipNotes: `Generated from job ${jobNumber}`,
    };
  }
}
