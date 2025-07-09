import { 
  ICustomerStrategy, 
  ParsedCustomerData, 
  ValidationResult, 
  CustomerKit, 
  CustomerBranding,
  CustomerKitItem
} from './customer-strategy.interface';

export abstract class CustomerStrategy implements ICustomerStrategy {
  abstract customerCode: string;
  abstract displayName: string;

  // Abstract methods that must be implemented by each customer strategy
  abstract parseFile(fileBuffer: Buffer, filename: string): Promise<ParsedCustomerData>;
  abstract validateData(data: ParsedCustomerData): Promise<ValidationResult>;
  abstract generateKits(data: ParsedCustomerData): Promise<CustomerKit[]>;
  abstract customizeTemplate(kit: CustomerKit): CustomerBranding;
  abstract getShippingRules(kit: CustomerKit): {
    method: string;
    specialHandling: boolean;
    instructions: string[];
  };
  abstract getFileUploadInstructions(): {
    acceptedFormats: string[];
    maxFileSize: number;
    requiredColumns: string[];
    sampleData?: any;
  };

  // Common utility methods available to all strategies
  protected generateKitId(customerCode: string, rowIndex: number, timestamp: Date): string {
    const dateStr = timestamp.toISOString().split('T')[0].replace(/-/g, '');
    return `${customerCode}-${dateStr}-${String(rowIndex).padStart(4, '0')}`;
  }

  protected generateItemId(kitId: string, itemIndex: number): string {
    return `${kitId}-item-${String(itemIndex).padStart(3, '0')}`;
  }

  protected cleanString(value: any): string {
    if (typeof value !== 'string') {
      return String(value || '').trim();
    }
    return value.trim();
  }

  protected parseNumber(value: any): number {
    const num = parseFloat(String(value || '0'));
    return isNaN(num) ? 0 : num;
  }

  protected isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  protected validateRequiredFields(row: any, requiredFields: string[]): string[] {
    const errors: string[] = [];
    
    for (const field of requiredFields) {
      if (!row[field] || this.cleanString(row[field]) === '') {
        errors.push(`Missing required field: ${field}`);
      }
    }
    
    return errors;
  }

  protected createBaseValidationResult(): ValidationResult {
    return {
      isValid: true,
      errors: [],
      warnings: [],
      validRows: 0,
      totalRows: 0
    };
  }

  // Template method for the complete processing pipeline
  async processFile(fileBuffer: Buffer, filename: string): Promise<{
    kits: CustomerKit[];
    validation: ValidationResult;
    metadata: any;
  }> {
    // Step 1: Parse file
    const parsedData = await this.parseFile(fileBuffer, filename);
    
    // Step 2: Validate data
    const validation = await this.validateData(parsedData);
    
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Step 3: Generate kits
    const kits = await this.generateKits(parsedData);

    return {
      kits,
      validation,
      metadata: parsedData.metadata
    };
  }
}