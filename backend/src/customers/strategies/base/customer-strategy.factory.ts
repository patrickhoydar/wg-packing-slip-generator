import { Injectable, BadRequestException } from '@nestjs/common';
import { ICustomerStrategy } from './customer-strategy.interface';

@Injectable()
export class CustomerStrategyFactory {
  private strategies = new Map<string, ICustomerStrategy>();

  registerStrategy(customerCode: string, strategy: ICustomerStrategy): void {
    this.strategies.set(customerCode.toUpperCase(), strategy);
  }

  getStrategy(customerCode: string): ICustomerStrategy {
    const strategy = this.strategies.get(customerCode.toUpperCase());
    
    if (!strategy) {
      throw new BadRequestException(
        `No strategy found for customer code: ${customerCode}. Available strategies: ${Array.from(this.strategies.keys()).join(', ')}`
      );
    }
    
    return strategy;
  }

  getAllStrategies(): Array<{ customerCode: string; displayName: string; instructions: any }> {
    return Array.from(this.strategies.values()).map(strategy => ({
      customerCode: strategy.customerCode,
      displayName: strategy.displayName,
      instructions: strategy.getFileUploadInstructions()
    }));
  }

  hasStrategy(customerCode: string): boolean {
    return this.strategies.has(customerCode.toUpperCase());
  }

  getAvailableCustomerCodes(): string[] {
    return Array.from(this.strategies.keys());
  }
}