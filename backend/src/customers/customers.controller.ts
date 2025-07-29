import {
  Controller,
  Post,
  Param,
  UploadedFile,
  UseInterceptors,
  Get,
  Options,
  BadRequestException,
  Res,
  HttpStatus,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { CustomersService } from './customers.service';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get('strategies')
  async getAvailableStrategies() {
    return this.customersService.getAvailableStrategies();
  }

  @Get()
  async getAllCustomers() {
    return this.customersService.getAllCustomers();
  }

  @Get(':customerCode/instructions')
  async getUploadInstructions(@Param('customerCode') customerCode: string) {
    return this.customersService.getUploadInstructions(customerCode);
  }

  @Get(':customerCode/test')
  async testEndpoint(@Param('customerCode') customerCode: string) {
    return {
      message: `Backend is working for customer: ${customerCode}`,
      timestamp: new Date().toISOString(),
    };
  }

  @Options(':customerCode/upload')
  async uploadOptions() {
    return {};
  }

  @Post(':customerCode/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Param('customerCode') customerCode: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { jobNumber?: string },
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const result = await this.customersService.processFile(
      customerCode,
      file.buffer,
      file.originalname,
      body.jobNumber,
    );

    return {
      success: true,
      message: `Successfully processed ${result.kits.length} kits`,
      data: {
        kitsGenerated: result.kits.length,
        validation: result.validation,
        metadata: result.metadata,
        kits: result.kits,
      },
    };
  }

  @Post(':customerCode/generate-pdfs-chunked')
  async generateBatchPDFsChunked(
    @Param('customerCode') customerCode: string,
    @Body() body: { kits: any[]; chunkSize?: number },
    @Res() res: Response,
  ) {
    try {
      const kits = body.kits || [];
      const chunkSize = body.chunkSize || 100;

      if (!kits || kits.length === 0) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          message: 'No kits provided for PDF generation',
          error: 'kits array is empty or missing',
        });
      }

      const result = await this.customersService.generateBatchPDFsToDirectory(
        customerCode,
        kits,
        chunkSize,
      );

      // Return information about the generated PDFs instead of the files themselves
      res.status(HttpStatus.OK).json({
        success: true,
        message: `Generated ${result.totalGenerated} of ${kits.length} PDFs`,
        data: {
          totalRequested: kits.length,
          totalGenerated: result.totalGenerated,
          outputDirectory: result.outputDirectory,
          chunks: result.chunks,
          instructions:
            'PDFs have been saved to the local directory. Check the server logs for the exact path.',
        },
      });
    } catch (error) {
      console.error('Error generating chunked batch PDFs:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Failed to generate PDFs',
        error: error.message,
      });
    }
  }

  @Post(':customerCode/generate-pdfs')
  async generateBatchPDFs(
    @Param('customerCode') customerCode: string,
    @Body() body: { kits: any[]; chunkSize?: number },
    @Res() res: Response,
  ) {
    try {
      const kits = body.kits || [];
      const chunkSize = body.chunkSize || 100;

      if (!kits || kits.length === 0) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          message: 'No kits provided for PDF generation',
          error: 'kits array is empty or missing',
        });
      }

      // Generate individual PDFs to directory
      const result = await this.customersService.generateBatchPDFsToDirectory(
        customerCode,
        kits,
        chunkSize,
      );

      // Create merged PDF from the generated individual PDFs
      const mergedPdfBuffer =
        await this.customersService.createMergedPdfFromDirectory(
          result.outputDirectory,
        );

      // Set headers for PDF download
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${customerCode}-packing-slips-${timestamp}.pdf`;

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': mergedPdfBuffer.length.toString(),
      });

      res.status(HttpStatus.OK).send(mergedPdfBuffer);
    } catch (error) {
      console.error('Error generating batch PDFs:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Failed to generate PDFs',
        error: error.message,
      });
    }
  }

  @Post(':customerCode/validate')
  @UseInterceptors(FileInterceptor('file'))
  async validateFile(
    @Param('customerCode') customerCode: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const validation = await this.customersService.validateFile(
      customerCode,
      file.buffer,
      file.originalname,
    );

    return {
      success: validation.isValid,
      validation,
    };
  }

  @Post(':customerCode/preview')
  async generatePreviewData(
    @Param('customerCode') customerCode: string,
    @Body() body: { kit: any },
  ) {
    if (!body.kit) {
      throw new BadRequestException('No kit data provided');
    }

    const previewData = await this.customersService.generatePreviewData(
      customerCode,
      body.kit,
    );

    return {
      success: true,
      data: previewData,
    };
  }

  @Post(':customerCode/pace/create-shipment')
  async createPaceShipment(
    @Param('customerCode') customerCode: string,
    @Body() body: { kit: any; jobNumber: string },
  ) {
    if (!body.kit) {
      throw new BadRequestException('No kit data provided');
    }

    if (!body.jobNumber) {
      throw new BadRequestException('No job number provided');
    }

    const result = await this.customersService.createPaceShipmentForKit(
      customerCode,
      body.kit,
      body.jobNumber,
    );

    return {
      success: result.success,
      message: result.message,
      shipmentId: result.shipmentId,
      errors: result.errors,
    };
  }

  @Post(':customerCode/pace/create-batch-shipments')
  async createBatchPaceShipments(
    @Param('customerCode') customerCode: string,
    @Body() body: { kits: any[]; jobNumber: string },
  ) {
    if (!body.kits || !Array.isArray(body.kits) || body.kits.length === 0) {
      throw new BadRequestException('No kits data provided or invalid format');
    }

    if (!body.jobNumber) {
      throw new BadRequestException('No job number prefix provided');
    }

    const result = await this.customersService.createPaceShipmentsForKits(
      customerCode,
      body.kits,
      body.jobNumber,
    );

    return {
      success: true,
      results: result.results,
      summary: result.summary,
    };
  }
}
