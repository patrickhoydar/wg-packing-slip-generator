import { Module } from '@nestjs/common';
import { PdfController } from './pdf.controller';
import { PdfService } from './pdf.service';
import { PdfMergerService } from './pdf-merger.service';
import { ConcurrencyService } from '../common/services/concurrency.service';
import { CustomerStrategyFactory } from '../customers/strategies/base/customer-strategy.factory';
import { HHGlobalStrategy } from '../customers/strategies/hh-global/hh-global.strategy';
import { GeorgiaBaptistStrategy } from '../customers/strategies/georgia-baptist/georgia-baptist.strategy';
import { InquirEDStrategy } from '../customers/strategies/inquired/inquired.strategy';
import { InquirEDService } from '../customers/strategies/inquired/inquired.service';
import { CsvParserService } from '../common/services/csv-parser.service';

@Module({
  controllers: [PdfController],
  providers: [
    PdfService,
    PdfMergerService,
    ConcurrencyService,
    CustomerStrategyFactory,
    HHGlobalStrategy,
    GeorgiaBaptistStrategy,
    InquirEDStrategy,
    InquirEDService,
    CsvParserService,
  ],
  exports: [PdfService, PdfMergerService],
})
export class PdfModule {}
