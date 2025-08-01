import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Shipment, ShipmentStatus, Prisma } from '@prisma/client';

interface CreateShipmentDto {
  jobId: string;
  kitData: any;
  recipientName: string;
  recipientCompany?: string;
  shippingAddress: any;
  items: Array<{
    sku: string;
    description: string;
    quantity: number;
    customProperties?: any;
  }>;
}

@Injectable()
export class ShipmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createShipment(data: CreateShipmentDto): Promise<Shipment> {
    return this.prisma.shipment.create({
      data: {
        jobId: data.jobId,
        kitData: data.kitData,
        recipientName: data.recipientName,
        recipientCompany: data.recipientCompany,
        shippingAddress: data.shippingAddress,
        status: ShipmentStatus.pending,
        items: {
          create: data.items,
        },
      },
      include: {
        items: true,
      },
    });
  }

  async createManyShipments(shipments: CreateShipmentDto[]): Promise<number> {
    let createdCount = 0;

    // Use transaction for batch creation
    await this.prisma.$transaction(async (tx) => {
      for (const shipmentData of shipments) {
        await tx.shipment.create({
          data: {
            jobId: shipmentData.jobId,
            kitData: shipmentData.kitData,
            recipientName: shipmentData.recipientName,
            recipientCompany: shipmentData.recipientCompany,
            shippingAddress: shipmentData.shippingAddress,
            status: ShipmentStatus.pending,
            items: {
              create: shipmentData.items,
            },
          },
        });
        createdCount++;
      }
    });

    return createdCount;
  }

  async findById(id: string): Promise<Shipment | null> {
    return this.prisma.shipment.findUnique({
      where: { id },
      include: {
        items: true,
        job: {
          include: {
            customer: true,
          },
        },
      },
    });
  }

  async findByJobId(
    jobId: string,
    status?: ShipmentStatus,
  ): Promise<Shipment[]> {
    const where: Prisma.ShipmentWhereInput = { jobId };
    if (status) {
      where.status = status;
    }

    return this.prisma.shipment.findMany({
      where,
      include: {
        items: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateErpInfo(
    id: string,
    erpShipmentId: string,
    erpSystem: string,
    erpResponse: any,
  ): Promise<Shipment> {
    return this.prisma.shipment.update({
      where: { id },
      data: {
        erpShipmentId,
        erpSystem,
        erpResponse,
        status: ShipmentStatus.erp_created,
      },
    });
  }

  async updatePdfPath(id: string, pdfPath: string): Promise<Shipment> {
    return this.prisma.shipment.update({
      where: { id },
      data: {
        pdfPath,
        status: ShipmentStatus.pdf_generated,
      },
    });
  }

  async updateStatus(id: string, status: ShipmentStatus): Promise<Shipment> {
    return this.prisma.shipment.update({
      where: { id },
      data: { status },
    });
  }

  async getPendingShipmentsByJob(jobId: string): Promise<Shipment[]> {
    return this.prisma.shipment.findMany({
      where: {
        jobId,
        status: ShipmentStatus.pending,
      },
      include: {
        items: true,
        job: {
          include: {
            customer: true,
          },
        },
      },
    });
  }

  async getShipmentsForPdfGeneration(jobId: string): Promise<Shipment[]> {
    return this.prisma.shipment.findMany({
      where: {
        jobId,
        status: ShipmentStatus.erp_created,
        erpShipmentId: { not: null },
      },
      include: {
        items: true,
        job: {
          include: {
            customer: true,
          },
        },
      },
    });
  }
}
