import {
  Controller,
  Post,
  Body,
  Res,
  HttpStatus,
  Query,
  Get,
  Delete,
  Param,
} from '@nestjs/common';
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

  @Post('preview-packing-slip')
  async previewPackingSlip(
    @Body() packingSlipData: any,
    @Query('customerCode') customerCode: string = 'default',
    @Res() res: Response,
  ) {
    try {
      // DEBUG: Log what data we're receiving from the frontend
      console.log('[PDF-PREVIEW-DEBUG] Received data from frontend:', {
        hasJobNumber: !!packingSlipData.jobNumber,
        jobNumber: packingSlipData.jobNumber,
        hasShipmentInfo: !!packingSlipData.shipmentInfo,
        shipmentInfo: packingSlipData.shipmentInfo,
        hasErpShipmentId: !!packingSlipData.erpShipmentId,
        erpShipmentId: packingSlipData.erpShipmentId,
      });
      const html = await this.pdfService.generatePackingSlipHtmlPreview(
        packingSlipData,
        customerCode,
      );

      res.set({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      });

      res.status(HttpStatus.OK).send(html);
    } catch (error) {
      console.error('Error generating HTML preview:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Failed to generate HTML preview',
        error: error.message,
      });
    }
  }

  @Delete('template-cache/:customerStrategy')
  async invalidateTemplateCache(
    @Param('customerStrategy') customerStrategy: string,
    @Res() res: Response,
  ) {
    try {
      await this.pdfService.invalidateTemplate(customerStrategy);
      res.status(HttpStatus.OK).json({
        message: `Template cache invalidated for strategy: ${customerStrategy}`,
      });
    } catch (error) {
      console.error('Error invalidating template cache:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Failed to invalidate template cache',
        error: error.message,
      });
    }
  }

  @Delete('template-cache')
  async invalidateAllTemplateCache(@Res() res: Response) {
    try {
      // Get all template strategies and invalidate them
      const strategies = ['default', 'georgia-baptist', 'INQUIRED'];
      for (const strategy of strategies) {
        await this.pdfService.invalidateTemplate(strategy);
      }
      res.status(HttpStatus.OK).json({
        message: 'All template caches invalidated',
      });
    } catch (error) {
      console.error('Error invalidating all template caches:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Failed to invalidate all template caches',
        error: error.message,
      });
    }
  }
}
