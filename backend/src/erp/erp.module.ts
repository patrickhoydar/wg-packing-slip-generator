import { Module, Global } from '@nestjs/common';
import { ErpServiceFactory } from './erp-service.factory';

@Global()
@Module({
  providers: [ErpServiceFactory],
  exports: [ErpServiceFactory],
})
export class ErpModule {}
