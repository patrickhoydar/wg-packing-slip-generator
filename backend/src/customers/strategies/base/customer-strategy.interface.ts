export interface ParsedCustomerData {
  rawData: any[];
  metadata: {
    totalRows: number;
    columns: string[];
    customerCode: string;
    uploadedAt: Date;
    fileType?: string;
    [key: string]: any;
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
    company?: string;
    email?: string;
    phone?: string;
    address: {
      street: string;
      street2?: string;
      city: string;
      state: string;
      zipCode: string;
      country?: string;
    };
  };
  sender?: {
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
  shipping?: {
    service: string;
    weight?: number;
    packageCount?: number;
    isResidential: boolean;
    account?: string;
  };
  items: CustomerKitItem[];
  metadata: {
    originalRowIndex: number;
    customFields: Record<string, any>;
    orderReference?: string;
    sequenceNumber?: string;
    shippingMethod?: string;
    specialInstructions?: string[];
  };
}

export interface CustomerKitItem {
  id: string;
  sku: string;
  name: string;
  description: string;
  quantity: number;
  category: any;
  customProperties?: Record<string, any>;
}

export interface CustomerBranding {
  companyName: string;
  shouldOverrideCompany: boolean;
  logoUrl?: string;
  colors?: {
    primary: string;
    secondary: string;
  };
  customStyling?: Record<string, any>;
}

export interface ICustomerStrategy {
  customerCode: string;
  displayName: string;

  parseFile(fileBuffer: Buffer, filename: string): Promise<ParsedCustomerData>;
  validateData(data: ParsedCustomerData): Promise<ValidationResult>;
  generateKits(data: ParsedCustomerData): Promise<CustomerKit[]>;
  customizeTemplate(kit: CustomerKit): CustomerBranding;
  getShippingRules(kit: CustomerKit): {
    method: string;
    specialHandling: boolean;
    instructions: string[];
  };
  getFileUploadInstructions(): {
    acceptedFormats: string[];
    maxFileSize: number;
    requiredColumns: string[];
    sampleData?: any;
  };
  processFile(
    fileBuffer: Buffer,
    filename: string,
  ): Promise<{
    kits: CustomerKit[];
    validation: ValidationResult;
    metadata: any;
  }>;
}
