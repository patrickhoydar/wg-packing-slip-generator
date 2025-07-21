import { Controller, Post, Body, Res, HttpStatus, Query } from '@nestjs/common';
import { Response } from 'express';
import { PdfService } from './pdf.service';

@Controller('pdf')
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  @Post('generate-packing-slip')
  async generatePackingSlip(
    @Body() packingSlipData: any,
    @Query('customerStrategy') customerStrategy: string = 'default',
    @Res() res: Response,
  ) {
    try {
      const pdfBuffer = await this.pdfService.generatePackingSlipPdf(
        packingSlipData,
        customerStrategy,
      );
      
      // Include order type in filename if available
      const orderType = packingSlipData.orderType || 'unknown';
      const orderTypePrefix = orderType.toUpperCase();
      const filename = `${orderTypePrefix}-packing-slip-${packingSlipData.order?.orderNumber || 'document'}.pdf`;
      
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      });
      
      res.status(HttpStatus.OK).send(pdfBuffer);
    } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Failed to generate PDF',
        error: error.message,
      });
    }
  }
}