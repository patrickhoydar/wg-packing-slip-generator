import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PdfModule } from './pdf/pdf.module';
import { CustomersModule } from './customers/customers.module';

@Module({
  imports: [PdfModule, CustomersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
