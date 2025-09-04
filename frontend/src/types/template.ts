export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface TemplateElement {
  id: string;
  type: 'text' | 'company-header' | 'customer-info' | 'item-table' | 'order-summary' | 'logo' | 'signature' | 'divider';
  position: Position;
  size: Size;
  content: any; // Element-specific content
  styles?: {
    fontSize?: string;
    fontWeight?: string;
    color?: string;
    backgroundColor?: string;
    border?: string;
    padding?: string;
    textAlign?: 'left' | 'center' | 'right';
    [key: string]: any;
  };
  dataBinding?: {
    field?: string;
    defaultValue?: any;
  };
  locked?: boolean;
  visible?: boolean;
}

export interface Template {
  id: string;
  name: string;
  customerId?: string;
  customerCode?: string;
  elements: TemplateElement[];
  pageSettings: {
    width: number;
    height: number;
    margins: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
  };
  metadata?: {
    createdBy?: string;
    createdAt?: string;
    updatedAt?: string;
    version?: number;
  };
}

export interface DragItem {
  id: string;
  type: string;
  name: string;
  isNew?: boolean;
  currentPosition?: Position;
}