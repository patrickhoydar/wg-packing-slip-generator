import { Injectable } from '@nestjs/common';
import { ErpService } from './interfaces/erp-service.interface';

// ERP configuration for customers
export const ERP_ENABLED_CUSTOMERS: Record<string, string> = {
  INQUIRED: 'PACE',
  // Future: Add more customers and their ERP systems here
  // CUSTOMER_X: 'SAP',
  // CUSTOMER_Y: 'ORACLE',
};

@Injectable()
export class ErpServiceFactory {
  private erpServices: Map<string, ErpService> = new Map();

  registerErpService(erpSystem: string, service: ErpService): void {
    this.erpServices.set(erpSystem.toUpperCase(), service);
  }

  getErpService(erpSystem: string): ErpService | null {
    return this.erpServices.get(erpSystem.toUpperCase()) || null;
  }

  getErpSystemForCustomer(customerCode: string): string | null {
    return ERP_ENABLED_CUSTOMERS[customerCode.toUpperCase()] || null;
  }

  isErpEnabledForCustomer(customerCode: string): boolean {
    return !!ERP_ENABLED_CUSTOMERS[customerCode.toUpperCase()];
  }

  getErpServiceForCustomer(customerCode: string): ErpService | null {
    const erpSystem = this.getErpSystemForCustomer(customerCode);
    if (!erpSystem) {
      return null;
    }
    return this.getErpService(erpSystem);
  }
}
