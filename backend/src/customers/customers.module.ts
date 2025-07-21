import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { CustomerStrategyFactory } from './strategies/base/customer-strategy.factory';
import { HHGlobalStrategy } from './strategies/hh-global/hh-global.strategy';
import { GeorgiaBaptistStrategy } from './strategies/georgia-baptist/georgia-baptist.strategy';
import { InquireEdStrategy } from './strategies/inquire-ed/inquire-ed.strategy';
import { InquireEdService } from './strategies/inquire-ed/inquire-ed.service';
import { CsvParserService } from '../common/services/csv-parser.service';
import { PdfModule } from '../pdf/pdf.module';

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
    PdfModule,
  ],
  controllers: [CustomersController],
  providers: [
    CustomersService,
    CustomerStrategyFactory,
    HHGlobalStrategy,
    GeorgiaBaptistStrategy,
    InquireEdStrategy,
    InquireEdService,
    CsvParserService,
  ],
  exports: [CustomersService, CustomerStrategyFactory]
})
export class CustomersModule {}