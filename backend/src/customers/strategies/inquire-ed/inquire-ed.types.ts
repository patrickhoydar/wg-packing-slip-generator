export interface InquireEdBaseRow {
  'District or School': string;
  'Dock?': string;
  'Paved Path?': string;
  'Receiving Days': string;
  'Receiving Hours': string;
  'Delivery Address': string;
  'Shipping Contact Name': string;
  'Shipping Contact Email': string;
  'Shipping Contact Phone': string;
  'Delivery Notes'?: string;
  'Fall 2025 Earliest Delivery Date': string;
  'Appointment Required?': string;
}

export interface InquireEdPMRow extends InquireEdBaseRow {
  'Total Number of Boxes Ordered': string;
  // PM product columns with format "qty, grade" (e.g., "2, K")
  'IND-IJ-PM-NAVIG-EN-0100': string;
  'IND-IJ-PM-NAVIG-SP-0100': string;
  'IND-IJ-PM-MYTEAM-EN-0200': string;
  'IND-IJ-PM-MYTEAM-SP-0200': string;
  'IND-IJ-PM-PASTF-EN-0300': string;
  'IND-IJ-PM-PASTF-SP-0300': string;
  'IND-IJ-PM-FAMLF-EN-0400': string;
  'IND-IJ-PM-FAMLF-SP-0400': string;
  'IND-IJ-PM-LOCAT-EN-0500': string;
  'IND-IJ-PM-LOCAT-SP-0500': string;
  'IND-IJ-PM-CIVIC-EN-0600': string;
  'IND-IJ-PM-CIVIC-SP-0600': string;
  'IND-IJ-PM-NEEDS-EN-0700': string;
  'IND-IJ-PM-NEEDS-SP-0700': string;
  'IND-IJ-PM-LAND-EN-0800': string;
  'IND-IJ-PM-LAND-SP-0800': string;
  'IND-IJ-PM-INNOV-EN-0900': string;
  'IND-IJ-PM-INNOV-SP-0900': string;
  'IND-IJ-PM-GLOBAL-EN-1000': string;
  'IND-IJ-PM-GLOBAL-SP-1000': string;
  'IND-IJ-PM-MIGRA-EN-1100': string;
  'IND-IJ-PM-MIGRA-SP-1100': string;
  'IND-IJ-PM-CIVRT-EN-1200': string;
  'IND-IJ-PM-CIVRT-SP-1200': string;
  'IND-IJ-PM-NATRES-EN-1300': string;
  'IND-IJ-PM-NATRES-SP-1300': string;
  'IND-IJ-PM-OURST-EN-1400': string;
  'IND-IJ-PM-OURST-SP-1400': string;
  'IND-IJ-PM-ECON-EN-1500': string;
  'IND-IJ-PM-ECON-SP-1500': string;
  'IND-IJ-PM-NATAM-EN-1600': string;
  'IND-IJ-PM-NATAM-SP-1600': string;
  'IND-IJ-PM-COLO-EN-1700': string;
  'IND-IJ-PM-COLO-SP-1700': string;
  'IND-IJ-PM-AMREV-EN-1800': string;
  'IND-IJ-PM-AMREV-SP-1800': string;
  'IND-IJ-PM-RIGHTS-EN-1900': string;
  'IND-IJ-PM-RIGHTS-SP-1900': string;
}

export interface InquireEdTERow extends InquireEdBaseRow {
  'Total Number of TEs Ordered': string;
  // TE product columns with format "qty, No Sticker" or "qty, Needs Sticker: K"
  'IND-IJ-TE-NAVIG-0100': string;
  'IND-IJ-TE-MYTEAM-0200': string;
  'IND-IJ-TE-PASTF-0300': string;
  'IND-IJ-TE-FAMLF-0400': string;
  'IND-IJ-TE-LOCAT-0500': string;
  'IND-IJ-TE-CIVIC-0600': string;
  'IND-IJ-TE-NEEDS-0700': string;
  'IND-IJ-TE-LAND-0800': string;
  'IND-IJ-TE-INNOV-0900': string;
  'IND-IJ-TE-GLOBAL-1000': string;
  'IND-IJ-TE-MIGRA-1100': string;
  'IND-IJ-TE-CIVRT-1200': string;
  'IND-IJ-TE-NATRES-1300': string;
  'IND-IJ-TE-OURST-1400': string;
  'IND-IJ-TE-ECON-1500': string;
  'IND-IJ-TE-NATAM-1600': string;
  'IND-IJ-TE-COLO-1700': string;
  'IND-IJ-TE-AMREV-1800': string;
  'IND-IJ-TE-RIGHTS-1900': string;
}

export type InquireEdRow = InquireEdPMRow | InquireEdTERow;

export type InquireEdFileType = 'pm' | 'te';

export interface ParsedQuantity {
  quantity: number;
  gradeLevel?: string;
  needsSticker?: boolean;
}

export interface InquireEdProductInfo {
  sku: string;
  description: string;
  category: 'Printed Materials (English)' | 'Printed Materials (Spanish)' | 'Printed Teacher Editions';
}

export interface InquireEdDeliveryInfo {
  hasDock: boolean;
  hasPavedPath: boolean;
  receivingDays: string;
  receivingHours: string;
  deliveryNotes?: string;
  earliestDeliveryDate: string;
  appointmentRequired: boolean;
}

export interface InquireEdShippingContact {
  name: string;
  email: string;
  phone: string;
}

export interface InquireEdProcessedRow {
  schoolDistrict: string;
  deliveryAddress: string;
  shippingContact: InquireEdShippingContact;
  deliveryInfo: InquireEdDeliveryInfo;
  products: Array<{
    sku: string;
    quantity: number;
    gradeLevel?: string;
    needsSticker?: boolean;
  }>;
  fileType: InquireEdFileType;
  totalBoxes?: number;
  totalTEs?: number;
}

// Required columns for each file type
export const PM_REQUIRED_COLUMNS = [
  'District or School',
  'Delivery Address',
  'Shipping Contact Name',
  'Shipping Contact Email',
  'Fall 2025 Earliest Delivery Date',
] as const;

export const TE_REQUIRED_COLUMNS = [
  'District or School',
  'Delivery Address',
  'Shipping Contact Name',
  'Shipping Contact Email',
  'Fall 2025 Earliest Delivery Date',
] as const;

// Product column patterns
export const PM_PRODUCT_COLUMN_PATTERN = /^IND-IJ-PM-[A-Z]+-[A-Z]{2}-\d{4}$/;
export const TE_PRODUCT_COLUMN_PATTERN = /^IND-IJ-TE-[A-Z]+-\d{4}$/;

// Grade level pattern for PM products - handles formats like "2, K", "3, 1", "4, 5", etc.
export const GRADE_LEVEL_PATTERN = /^(\d+),\s*([KkGg]|\d+|[A-Za-z]+\d*|\d*[A-Za-z]+)$/;

// Sticker requirement pattern for TE products - handles formats like:
// "26, No Sticker", "26, Needs Sticker: 4", "1, No Sticker", etc.
export const STICKER_PATTERN = /^(\d+),\s*(No Sticker|Needs Sticker:\s*([KkGg]|\d+|[A-Za-z]+\d*|\d*[A-Za-z]+))$/;

// Delivery date patterns (flexible to handle various formats)
export const DELIVERY_DATE_PATTERNS = [
  /^\d{1,2}\/\d{1,2}\/\d{4}$/,  // MM/DD/YYYY
  /^\d{4}-\d{2}-\d{2}$/,        // YYYY-MM-DD
  /^\d{1,2}-\d{1,2}-\d{4}$/,    // MM-DD-YYYY
  /^\d{1,2}\/\d{1,2}\/\d{2}$/,  // MM/DD/YY
];

export interface InquireEdConfig {
  skuLookupFile: string;
  maxFileSize: number;
  supportedFormats: string[];
  defaultReceivingHours: string;
  defaultReceivingDays: string;
}