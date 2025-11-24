import { Injectable } from '@nestjs/common';
import { CustomerStrategy } from '../base/customer-strategy.abstract';
import {
  ParsedCustomerData,
  ValidationResult,
  CustomerKit,
  CustomerBranding,
} from '../base/customer-strategy.interface';

@Injectable()
export class ScholasticStrategy extends CustomerStrategy {
  customerCode = 'SCHOLASTIC';
  displayName = 'Scholastic';

  async parseFile(
    fileBuffer: Buffer,
    filename: string,
  ): Promise<ParsedCustomerData> {
    // For template editor, we don't need file parsing
    // This would be implemented when Scholastic provides CSV files
    return {
      rawData: [],
      metadata: {
        totalRows: 0,
        columns: [],
        customerCode: this.customerCode,
        uploadedAt: new Date(),
      },
    };
  }

  async validateData(data: ParsedCustomerData): Promise<ValidationResult> {
    const result = this.createBaseValidationResult();
    result.totalRows = data.rawData.length;
    result.validRows = data.rawData.length;
    result.isValid = true;
    return result;
  }

  async generateKits(
    data: ParsedCustomerData,
    jobNumber?: string,
  ): Promise<CustomerKit[]> {
    // For template editor, we don't generate kits from CSV
    // This would be implemented when Scholastic provides CSV files
    return [];
  }

  customizeTemplate(kit: CustomerKit): CustomerBranding {
    return {
      companyName: 'Scholastic',
      shouldOverrideCompany: false,
      customStyling: {
        templateName: 'scholastic',
      },
    };
  }

  getShippingRules(kit: CustomerKit) {
    return {
      method: 'Standard',
      specialHandling: false,
      instructions: [],
    };
  }

  getFileUploadInstructions() {
    return {
      acceptedFormats: ['csv', 'json'],
      maxFileSize: 10 * 1024 * 1024, // 10MB
      requiredColumns: [],
      sampleData: {
        description: 'Scholastic order data',
        columns: {},
        specialNotes: [],
      },
    };
  }
}