import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { ErpModule } from './erp/erp.module';
import { PdfModule } from './pdf/pdf.module';
import { CustomersModule } from './customers/customers.module';
import { PaceModule } from './pace/pace.module';
import { JobsModule } from './jobs/jobs.module';
import { ShipmentsModule } from './shipments/shipments.module';
import { TemplatesModule } from './templates/templates.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    ErpModule,
    PdfModule,
    CustomersModule,
    PaceModule,
    JobsModule,
    ShipmentsModule,
    TemplatesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
