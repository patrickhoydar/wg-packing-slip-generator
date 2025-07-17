export interface CustomerStrategy {
  customerCode: string;
  displayName: string;
  instructions: {
    acceptedFormats: string[];
    maxFileSize: number;
    requiredColumns: string[];
    sampleData?: Record<string, unknown>;
  };
  parser: CustomerDataParser;
  templateConfig: TemplateConfiguration;
}

export interface CustomerDataParser {
  fileTypes: string[];
  delimiter: string;
  encoding: string;
  hasHeader: boolean;
  parseRow: (row: string[], headers: string[]) => CustomerKit;
  validateFile: (data: string[][]) => ValidationResult;
  detectFileType: (headers: string[]) => 'ups' | 'pobox' | 'unknown';
}

export interface TemplateConfiguration {
  requiredFields: string[];
  optionalFields: string[];
  fieldMappings: Record<string, string>;
  defaultValues: Record<string, any>;
  customRules: CustomRule[];
}

export interface CustomRule {
  field: string;
  condition: (value: any) => boolean;
  action: (value: any) => any;
  description: string;
}

export interface UploadResult {
  success: boolean;
  message: string;
  data?: {
    kitsGenerated: number;
    validation: ValidationResult;
    metadata: Record<string, unknown>;
    kits: CustomerKit[];
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  validRows: number;
  totalRows: number;
}

export interface CustomerKit {
  id: string;
  customerCode: string;
  recipient: {
    name: string;
    company: string;
    address: {
      street: string;
      street2?: string;
      city: string;
      state: string;
      zipCode: string;
      country?: string;
    };
  };
  sender: {
    company: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
    };
  };
  billing?: {
    company: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
    };
  };
  items: CustomerKitItem[];
  shipping: {
    service: string;
    weight?: number;
    packageCount?: number;
    isResidential: boolean;
    account?: string;
  };
  metadata: {
    originalRowIndex: number;
    customFields: Record<string, unknown>;
    orderReference: string;
    sequenceNumber: string;
    specialInstructions?: string[];
  };
}

export interface CustomerKitItem {
  id: string;
  sku: string;
  name: string;
  description: string;
  quantity: number;
  category: 'posters-eng' | 'posters-spa' | 'inserts' | 'guides-eng' | 'guides-spa' | 'envelopes' | 'cards' | 'other';
  customProperties?: Record<string, unknown>;
}

export type CustomerType = 'georgia-baptist' | 'just-right-reader';

export interface Customer {
  id: string;
  name: string;
  type: CustomerType;
  strategy: CustomerStrategy;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}