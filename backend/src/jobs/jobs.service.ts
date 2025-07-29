import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Job, JobStatus, Prisma } from '@prisma/client';
import { ShipmentsService } from '../shipments/shipments.service';

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shipmentsService: ShipmentsService,
  ) {}

  async createJob(data: {
    jobNumber: string;
    customerId: string;
    uploadedFileName: string;
  }): Promise<Job> {
    return this.prisma.job.create({
      data: {
        ...data,
        status: JobStatus.uploaded,
      },
      include: {
        customer: true,
      },
    });
  }

  async createJobWithShipments(data: {
    jobNumber: string;
    customerId: string;
    uploadedFileName: string;
    kits: any[];
  }): Promise<{ job: Job; shipmentsCreated: number }> {
    // Create the job first
    const job = await this.createJob({
      jobNumber: data.jobNumber,
      customerId: data.customerId,
      uploadedFileName: data.uploadedFileName,
    });

    // Transform kits into shipment data
    const shipmentData = data.kits.map(kit => this.transformKitToShipment(kit, job.id));

    // Create all shipments
    const shipmentsCreated = await this.shipmentsService.createManyShipments(shipmentData);

    // Update job with shipment count
    const updatedJob = await this.updateShipmentCount(job.id);

    return {
      job: updatedJob,
      shipmentsCreated,
    };
  }

  private transformKitToShipment(kit: any, jobId: string) {
    // Extract recipient information from kit
    const recipientName = kit.recipient?.name || kit.recipientName || 'Unknown Recipient';
    const recipientCompany = kit.recipient?.company || kit.recipientCompany || null;
    
    // Extract shipping address
    const shippingAddress = kit.recipient?.address || kit.shippingAddress || {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'US',
    };

    // Transform kit items to shipment items
    const items = (kit.items || []).map((item: any) => ({
      sku: item.sku || item.id || 'UNKNOWN',
      description: item.description || item.name || 'Unknown Item',
      quantity: item.quantity || 1,
      customProperties: item.customProperties || null,
    }));

    return {
      jobId,
      kitData: kit, // Store the original kit data
      recipientName,
      recipientCompany,
      shippingAddress,
      items,
    };
  }

  async findByJobNumber(
    customerId: string,
    jobNumber: string,
  ): Promise<Job | null> {
    return this.prisma.job.findUnique({
      where: {
        customerId_jobNumber: {
          customerId,
          jobNumber,
        },
      },
      include: {
        customer: true,
        shipments: true,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.job.findUnique({
      where: { id },
      include: {
        customer: true,
        shipments: {
          include: {
            items: true,
          },
        },
      },
    });
  }

  async updateStatus(id: string, status: JobStatus): Promise<Job> {
    return this.prisma.job.update({
      where: { id },
      data: { status },
    });
  }

  async updateShipmentCount(id: string): Promise<Job> {
    const shipmentCount = await this.prisma.shipment.count({
      where: { jobId: id },
    });

    return this.prisma.job.update({
      where: { id },
      data: { totalShipments: shipmentCount },
    });
  }

  async findAllByCustomer(
    customerId: string,
    take?: number,
    skip?: number,
  ): Promise<{ jobs: Job[]; total: number }> {
    const where: Prisma.JobWhereInput = { customerId };

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        include: {
          customer: true,
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.job.count({ where }),
    ]);

    return { jobs, total };
  }

  async getJobStats(id: string): Promise<{
    total: number;
    pending: number;
    erpCreated: number;
    pdfGenerated: number;
    failed: number;
  }> {
    const shipments = await this.prisma.shipment.groupBy({
      by: ['status'],
      where: { jobId: id },
      _count: true,
    });

    const stats = {
      total: 0,
      pending: 0,
      erpCreated: 0,
      pdfGenerated: 0,
      failed: 0,
    };

    shipments.forEach((group) => {
      stats.total += group._count;
      switch (group.status) {
        case 'pending':
          stats.pending = group._count;
          break;
        case 'erp_created':
          stats.erpCreated = group._count;
          break;
        case 'pdf_generated':
          stats.pdfGenerated = group._count;
          break;
        case 'failed':
          stats.failed = group._count;
          break;
      }
    });

    return stats;
  }
}