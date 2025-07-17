export interface CustomerStrategy {
  customerCode: string;
  displayName: string;
  instructions: {
    acceptedFormats: string[];
    maxFileSize: number;
    requiredColumns: string[];
    sampleData?: Record<string, unknown>;
  };
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
    email: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country?: string;
    };
  };
  items: CustomerKitItem[];
  metadata: {
    originalRowIndex: number;
    customFields: Record<string, unknown>;
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
  category: 'seed-guide' | 'collateral' | 'other';
  customProperties?: Record<string, unknown>;
}