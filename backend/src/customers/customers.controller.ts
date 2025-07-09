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
  Body
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

  @Get(':customerCode/instructions')
  async getUploadInstructions(@Param('customerCode') customerCode: string) {
    return this.customersService.getUploadInstructions(customerCode);
  }

  @Get(':customerCode/test')
  async testEndpoint(@Param('customerCode') customerCode: string) {
    return {
      message: `Backend is working for customer: ${customerCode}`,
      timestamp: new Date().toISOString()
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
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const result = await this.customersService.processFile(
      customerCode,
      file.buffer,
      file.originalname
    );

    return {
      success: true,
      message: `Successfully processed ${result.kits.length} kits`,
      data: {
        kitsGenerated: result.kits.length,
        validation: result.validation,
        metadata: result.metadata,
        kits: result.kits
      }
    };
  }

  @Post(':customerCode/generate-pdfs')
  async generateBatchPDFs(
    @Param('customerCode') customerCode: string,
    @Body() body: { kits: any[] },
    @Res() res: Response
  ) {
    try {
      const kits = body.kits || [];
      
      if (!kits || kits.length === 0) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          message: 'No kits provided for PDF generation',
          error: 'kits array is empty or missing'
        });
      }
      
      const pdfBuffer = await this.customersService.generateBatchPDFs(customerCode, kits);
      
      const filename = `${customerCode}-packing-slips-${new Date().toISOString().split('T')[0]}.zip`;
      
      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      });
      
      res.status(HttpStatus.OK).send(pdfBuffer);
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
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const validation = await this.customersService.validateFile(
      customerCode,
      file.buffer,
      file.originalname
    );

    return {
      success: validation.isValid,
      validation
    };
  }
}