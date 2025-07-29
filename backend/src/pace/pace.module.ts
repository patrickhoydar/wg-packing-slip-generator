import { Module, OnModuleInit } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '../config/config.module';
import { PaceService } from './pace.service';
import { PaceController } from './pace.controller';
import { ErpServiceFactory } from '../erp/erp-service.factory';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    ConfigModule,
  ],
  controllers: [PaceController],
  providers: [PaceService],
  exports: [PaceService],
})
export class PaceModule implements OnModuleInit {
  constructor(
    private readonly paceService: PaceService,
    private readonly erpServiceFactory: ErpServiceFactory,
  ) {}

  onModuleInit() {
    // Register PACE service with the ERP factory
    this.erpServiceFactory.registerErpService('PACE', this.paceService);
  }
}
