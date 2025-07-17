import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { CustomerStrategyFactory } from './strategies/base/customer-strategy.factory';
import { HHGlobalStrategy } from './strategies/hh-global/hh-global.strategy';
import { PdfService } from '../pdf/pdf.service';
import { FileBasedPdfService } from '../pdf/file-based-pdf.service';
import { PdfMergerService } from '../pdf/pdf-merger.service';
import { ConcurrencyService } from '../common/services/concurrency.service';

@Module({
  imports: [
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, cb) => {
        const allowedMimes = [
          'text/csv',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type. Only CSV and XLSX files are allowed.'), false);
        }
      },
    }),
  ],
  controllers: [CustomersController],
  providers: [
    CustomersService,
    CustomerStrategyFactory,
    HHGlobalStrategy,
    PdfService,
    FileBasedPdfService,
    PdfMergerService,
    ConcurrencyService
  ],
  exports: [CustomersService, CustomerStrategyFactory]
})
export class CustomersModule {}