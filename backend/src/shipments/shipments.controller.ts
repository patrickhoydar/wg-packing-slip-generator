import { Controller, Get, Param, NotFoundException, Res } from '@nestjs/common';
import { Response } from 'express';
import { ShipmentsService } from './shipments.service';
import * as fs from 'fs';

@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Get(':id')
  async getShipment(@Param('id') id: string) {
    const shipment = await this.shipmentsService.findById(id);
    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }
    return shipment;
  }

  @Get(':id/pdf')
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const shipment = await this.shipmentsService.findById(id);
    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    if (!shipment.pdfPath) {
      throw new NotFoundException('PDF not generated for this shipment');
    }

    // Check if file exists
    if (!fs.existsSync(shipment.pdfPath)) {
      throw new NotFoundException('PDF file not found on server');
    }

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="shipment-${shipment.erpShipmentId || shipment.id}.pdf"`,
    );

    // Stream the file
    const fileStream = fs.createReadStream(shipment.pdfPath);
    fileStream.pipe(res);
  }
}
