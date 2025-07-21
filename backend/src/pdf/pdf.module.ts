import { Module } from '@nestjs/common';
import { PdfController } from './pdf.controller';
import { PdfService } from './pdf.service';
import { PdfMergerService } from './pdf-merger.service';
import { ConcurrencyService } from '../common/services/concurrency.service';

@Module({
  controllers: [PdfController],
  providers: [PdfService, PdfMergerService, ConcurrencyService],
  exports: [PdfService, PdfMergerService],
})
export class PdfModule {}