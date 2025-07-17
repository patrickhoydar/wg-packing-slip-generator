import { Injectable } from '@nestjs/common';
import { CustomerStrategy } from '../base/customer-strategy.abstract';
import {
  ParsedCustomerData,
  ValidationResult,
  CustomerKit,
  CustomerBranding,
  CustomerKitItem,
} from '../base/customer-strategy.interface';
import { CsvParserService } from '../../../common/services/csv-parser.service';
import { InquireEdService } from './inquire-ed.service';
import {
  InquireEdRow,
  InquireEdPMRow,
  InquireEdTERow,
  InquireEdFileType,
  InquireEdProcessedRow,
  InquireEdProductInfo,
  InquireEdDeliveryInfo,
  InquireEdShippingContact,
  ParsedQuantity,
  PM_REQUIRED_COLUMNS,
  TE_REQUIRED_COLUMNS,
  PM_PRODUCT_COLUMN_PATTERN,
  TE_PRODUCT_COLUMN_PATTERN,
  GRADE_LEVEL_PATTERN,
  STICKER_PATTERN,
  DELIVERY_DATE_PATTERNS,
} from './inquire-ed.types';

@Injectable()
export class InquireEdStrategy extends CustomerStrategy {
  customerCode = 'INQUIRE_ED';
  displayName = 'InquireEd';

  constructor(
    private csvParser: CsvParserService,
    private inquireEdService: InquireEdService,
  ) {
    super();
    this.inquireEdService.loadSkuLookupTable();
  }

  async parseFile(
    fileBuffer: Buffer,
    filename: string,
  ): Promise<ParsedCustomerData> {
    const parseResult = await this.csvParser.parseCSV<InquireEdRow>(fileBuffer);

    if (parseResult.errors.length > 0) {
      throw new Error(
        `CSV parsing errors: ${parseResult.errors.map((e) => e.message).join(', ')}`,
      );
    }

    const rawData = parseResult.data;

    if (rawData.length === 0) {
      throw new Error('File is empty');
    }

    // Detect file type based on column headers
    const fileType = this.detectFileType(parseResult.metadata.columns);

    if (fileType === 'unknown') {
      throw new Error(
        'Unrecognized file format. Expected PM Orders or TE Orders format.',
      );
    }

    // Process each row
    const processedData = rawData.map((row, index) => {
      try {
        return this.processRow(row, fileType, index);
      } catch (error) {
        console.error(`Error processing row ${index + 1}:`, error);
        throw new Error(`Row ${index + 1}: ${error.message}`);
      }
    });

    return {
      rawData: processedData,
      metadata: {
        totalRows: rawData.length,
        columns: parseResult.metadata.columns,
        customerCode: this.customerCode,
        uploadedAt: new Date(),
        fileType,
        encoding: parseResult.metadata.encoding,
        hasBOM: parseResult.metadata.hasBOM,
      },
    };
  }

  async validateData(data: ParsedCustomerData): Promise<ValidationResult> {
    const result = this.createBaseValidationResult();
    result.totalRows = data.rawData.length;

    if (data.rawData.length === 0) {
      result.isValid = false;
      result.errors.push('No data found in uploaded file');
      return result;
    }

    const fileType = data.metadata.fileType as InquireEdFileType;
    const requiredColumns = this.getRequiredColumnsForFileType(fileType);

    // Validate each row
    for (let i = 0; i < data.rawData.length; i++) {
      const row = data.rawData[i] as InquireEdProcessedRow;
      const rowErrors = this.validateRow(row, requiredColumns, i + 1);

      if (rowErrors.length > 0) {
        result.errors.push(...rowErrors);
      } else {
        result.validRows++;
      }
    }

    // Check if we have any valid rows
    if (result.validRows === 0) {
      result.isValid = false;
      result.errors.push('No valid rows found in the uploaded file');
    }

    // Warnings for common issues
    const rowsWithoutProducts = data.rawData.filter(
      (row: InquireEdProcessedRow) => row.products.length === 0,
    );

    if (rowsWithoutProducts.length > 0) {
      result.warnings.push(
        `${rowsWithoutProducts.length} rows have no products`,
      );
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  async generateKits(data: ParsedCustomerData): Promise<CustomerKit[]> {
    const kits: CustomerKit[] = [];
    const timestamp = new Date();

    for (let i = 0; i < data.rawData.length; i++) {
      const row = data.rawData[i] as InquireEdProcessedRow;

      // Skip rows with no products
      if (row.products.length === 0) {
        continue;
      }

      try {
        const kit = this.createKitFromRow(row, i, timestamp);
        kits.push(kit);
      } catch (error) {
        console.error(`Error creating kit for row ${i + 1}:`, error);
        // Continue processing other rows
      }
    }

    return kits;
  }

  customizeTemplate(kit: CustomerKit): CustomerBranding {
    return {
      companyName: 'InquireEd',
      shouldOverrideCompany: true,
      colors: {
        primary: '#2563eb', // Blue
        secondary: '#64748b', // Gray
      },
      customStyling: {
        headerStyle: 'inquire-ed-header',
        footerText: 'InquireEd Educational Materials',
        logoUrl: '/assets/logos/inquire-ed.png',
      },
    };
  }

  getShippingRules(kit: CustomerKit): {
    method: string;
    specialHandling: boolean;
    instructions: string[];
  } {
    const deliveryInfo = kit.metadata.customFields
      .deliveryInfo as InquireEdDeliveryInfo;
    const instructions: string[] = [];

    // Add delivery-specific instructions
    if (deliveryInfo.appointmentRequired) {
      instructions.push('APPOINTMENT REQUIRED - Call before delivery');
    }

    if (!deliveryInfo.hasDock) {
      instructions.push('NO LOADING DOCK - Manual unloading required');
    }

    if (!deliveryInfo.hasPavedPath) {
      instructions.push('NO PAVED PATH - Consider delivery method');
    }

    if (deliveryInfo.receivingHours) {
      instructions.push(`Receiving Hours: ${deliveryInfo.receivingHours}`);
    }

    if (deliveryInfo.receivingDays) {
      instructions.push(`Receiving Days: ${deliveryInfo.receivingDays}`);
    }

    if (deliveryInfo.deliveryNotes) {
      instructions.push(`Special Notes: ${deliveryInfo.deliveryNotes}`);
    }

    // Add earliest delivery date
    if (deliveryInfo.earliestDeliveryDate) {
      instructions.push(
        `Earliest Delivery: ${deliveryInfo.earliestDeliveryDate}`,
      );
    }

    return {
      method: 'GROUND',
      specialHandling:
        deliveryInfo.appointmentRequired || !deliveryInfo.hasDock,
      instructions,
    };
  }

  getFileUploadInstructions() {
    return {
      acceptedFormats: ['csv'],
      maxFileSize: 10 * 1024 * 1024, // 10MB
      requiredColumns: [
        'District or School',
        'Delivery Address',
        'Shipping Contact Name',
        'Shipping Contact Email',
        'Fall 2025 Earliest Delivery Date',
      ],
      sampleData: {
        pmOrders: {
          description:
            'Printed Materials Orders - Student books in English and Spanish',
          quantityFormat: '"2, K" (quantity 2, grade K)',
          columns: {
            'District or School': 'School or district name',
            'Delivery Address': 'Full delivery address',
            'Shipping Contact Name': 'Contact person name',
            'Shipping Contact Email': 'Contact email address',
            'IND-IJ-PM-*-EN-*':
              'English printed materials with quantity and grade',
            'IND-IJ-PM-*-SP-*':
              'Spanish printed materials with quantity and grade',
          },
        },
        teOrders: {
          description: 'Teacher Edition Orders - Teacher resources',
          quantityFormat: '"30, No Sticker" or "28, Needs Sticker: K"',
          columns: {
            'District or School': 'School or district name',
            'Delivery Address': 'Full delivery address',
            'Shipping Contact Name': 'Contact person name',
            'Shipping Contact Email': 'Contact email address',
            'IND-IJ-TE-*':
              'Teacher editions with quantity and sticker requirements',
          },
        },
        specialNotes: [
          'Upload either PM Orders or TE Orders file (not both simultaneously)',
          'Quantity format includes grade level for PM orders',
          'Sticker requirements specified for TE orders',
          'Delivery dates and appointment requirements are processed automatically',
        ],
      },
    };
  }

  private detectFileType(columns: string[]): InquireEdFileType | 'unknown' {
    // Required base columns that should be present in both file types
    const requiredBaseColumns = [
      'District or School',
      'Dock?',
      'Paved Path?',
      'Receiving Days',
      'Receiving Hours',
      'Delivery Address',
      'Shipping Contact Name',
      'Shipping Contact Email',
      'Shipping Contact Phone',
      'Appointment Required?',
    ];

    // Check if we have the required base structure
    console.log('InquireEd File Type Detection:');
    console.log('Available columns:', columns);

    // Clean column headers to handle BOM and other issues
    const cleanedColumns = columns.map((col, index) => {
      // Remove BOM characters and trim whitespace
      const cleaned = col
        .replace(/^\ufeff/, '')
        .replace(/\uFEFF/g, '')
        .trim();
      console.log(
        `Column ${index}: Original: "${col}" (${col.length} chars) -> Cleaned: "${cleaned}" (${cleaned.length} chars)`,
      );
      if (index === 0) {
        console.log(
          'First column char codes:',
          [...col].map((c) => c.charCodeAt(0)),
        );
      }
      return cleaned;
    });

    const missingColumns: string[] = [];
    const foundColumns: string[] = [];

    const hasBaseColumns = requiredBaseColumns.every((col) => {
      const found = cleanedColumns.some((headerCol) => headerCol === col);
      if (found) {
        foundColumns.push(col);
      } else {
        missingColumns.push(col);
      }
      return found;
    });

    console.log('Required columns found:', foundColumns);
    console.log('Missing required columns:', missingColumns);

    if (!hasBaseColumns) {
      console.log('File type detection failed - missing required base columns');
      return 'unknown';
    }

    // PM-specific indicators
    const hasPMIndicators = cleanedColumns.some(
      (col) =>
        col.includes('Total Number of Boxes Ordered') ||
        col.includes('Delivery Notes'),
    );

    // TE-specific indicators
    const hasTEIndicators = cleanedColumns.some((col) =>
      col.includes('Total Number of TEs Ordered'),
    );

    // Check for SKU patterns as secondary validation
    const hasPMSKUs = cleanedColumns.some((col) =>
      PM_PRODUCT_COLUMN_PATTERN.test(col),
    );
    const hasTESKUs = cleanedColumns.some((col) =>
      TE_PRODUCT_COLUMN_PATTERN.test(col),
    );

    console.log('File type indicators:');
    console.log('- PM indicators found:', hasPMIndicators);
    console.log('- TE indicators found:', hasTEIndicators);
    console.log('- PM SKUs found:', hasPMSKUs);
    console.log('- TE SKUs found:', hasTESKUs);

    // Determine file type based on indicators and SKU patterns
    if (hasPMIndicators && (hasPMSKUs || !hasTESKUs)) {
      console.log('Detected file type: PM (Printed Materials)');
      return 'pm';
    }

    if (hasTEIndicators && (hasTESKUs || !hasPMSKUs)) {
      console.log('Detected file type: TE (Teacher Editions)');
      return 'te';
    }

    // Fallback to SKU pattern detection if indicators are unclear
    if (hasPMSKUs && !hasTESKUs) {
      console.log('Detected file type: PM (by SKU pattern fallback)');
      return 'pm';
    }
    if (hasTESKUs && !hasPMSKUs) {
      console.log('Detected file type: TE (by SKU pattern fallback)');
      return 'te';
    }

    console.log('File type detection failed - no clear indicators found');
    return 'unknown';
  }

  private processRow(
    row: InquireEdRow,
    fileType: InquireEdFileType,
    _index: number,
  ): InquireEdProcessedRow {
    const schoolDistrict = this.csvParser.cleanString(
      row['District or School'],
    );
    const deliveryAddress = this.csvParser.cleanString(row['Delivery Address']);

    const shippingContact: InquireEdShippingContact = {
      name: this.csvParser.cleanString(row['Shipping Contact Name']),
      email: this.csvParser.cleanString(row['Shipping Contact Email']),
      phone: this.csvParser.cleanString(row['Shipping Contact Phone']),
    };

    const deliveryInfo: InquireEdDeliveryInfo = {
      hasDock: this.csvParser.cleanString(row['Dock?']).toLowerCase() === 'yes',
      hasPavedPath:
        this.csvParser.cleanString(row['Paved Path?']).toLowerCase() === 'yes',
      receivingDays: this.csvParser.cleanString(row['Receiving Days']) || 'M-F',
      receivingHours:
        this.csvParser.cleanString(row['Receiving Hours']) || '8 AM - 4 PM',
      deliveryNotes: this.csvParser.cleanString(row['Delivery Notes']),
      earliestDeliveryDate: this.csvParser.cleanString(
        row['Fall 2025 Earliest Delivery Date'],
      ),
      appointmentRequired:
        this.csvParser
          .cleanString(row['Appointment Required?'])
          .toLowerCase() === 'yes',
    };

    const products = this.extractProducts(row, fileType);

    const result: InquireEdProcessedRow = {
      schoolDistrict,
      deliveryAddress,
      shippingContact,
      deliveryInfo,
      products,
      fileType,
    };

    if (fileType === 'pm') {
      result.totalBoxes = this.parseNumber(
        (row as InquireEdPMRow)['Total Number of Boxes Ordered'],
      );
    } else {
      result.totalTEs = this.parseNumber(
        (row as InquireEdTERow)['Total Number of TEs Ordered'],
      );
    }

    return result;
  }

  private extractProducts(
    row: InquireEdRow,
    fileType: InquireEdFileType,
  ): Array<{
    sku: string;
    quantity: number;
    gradeLevel?: string;
    needsSticker?: boolean;
  }> {
    const products: Array<{
      sku: string;
      quantity: number;
      gradeLevel?: string;
      needsSticker?: boolean;
    }> = [];

    // Define known non-SKU columns that should be excluded from product extraction
    const nonSkuColumns = [
      'District or School',
      'Dock?',
      'Paved Path?',
      'Receiving Days',
      'Receiving Hours',
      'Delivery Address',
      'Shipping Contact Name',
      'Shipping Contact Email',
      'Shipping Contact Phone',
      'Delivery Notes',
      'Total Number of Boxes Ordered',
      'Total Number of TEs Ordered',
      'Fall 2025 Earliest Delivery Date',
      'Appointment Required?',
    ];

    // Extract products from any column that isn't a known non-SKU column
    for (const [column, value] of Object.entries(row)) {
      // Skip known non-SKU columns
      if (nonSkuColumns.includes(column)) {
        continue;
      }

      // Also skip if column is empty or undefined
      if (!column || column.trim() === '') {
        continue;
      }

      const cleanValue = this.csvParser.cleanString(value);
      if (cleanValue) {
        const parsedQuantity = this.parseQuantityString(cleanValue, fileType);
        if (parsedQuantity.quantity > 0) {
          products.push({
            sku: column,
            quantity: parsedQuantity.quantity,
            gradeLevel: parsedQuantity.gradeLevel,
            needsSticker: parsedQuantity.needsSticker,
          });
        }
      }
    }

    return products;
  }

  private parseQuantityString(
    value: string,
    fileType: InquireEdFileType,
  ): ParsedQuantity {
    const result: ParsedQuantity = { quantity: 0 };

    if (fileType === 'pm') {
      // Handle PM format: "2, K", "3, 1", "4, 5", etc.
      const match = value.match(GRADE_LEVEL_PATTERN);
      if (match) {
        result.quantity = parseInt(match[1], 10) || 0;
        result.gradeLevel = this.normalizeGradeLevel(match[2] || '');
      } else {
        // Fallback: try to parse just the number if no grade level
        const numMatch = value.match(/^(\d+)/);
        if (numMatch) {
          result.quantity = parseInt(numMatch[1], 10) || 0;
        }
      }
    } else if (fileType === 'te') {
      // Handle TE format: "26, No Sticker", "26, Needs Sticker: 4", etc.
      const match = value.match(STICKER_PATTERN);
      if (match) {
        result.quantity = parseInt(match[1], 10) || 0;
        result.needsSticker = match[2] !== 'No Sticker';
        if (result.needsSticker && match[3]) {
          result.gradeLevel = this.normalizeGradeLevel(match[3]);
        }
      } else {
        // Fallback: try to parse just the number if no sticker info
        const numMatch = value.match(/^(\d+)/);
        if (numMatch) {
          result.quantity = parseInt(numMatch[1], 10) || 0;
          // If no sticker info, assume no sticker needed
          result.needsSticker = false;
        }
      }
    }

    return result;
  }

  private normalizeGradeLevel(grade: string): string {
    if (!grade) return '';

    // Convert common grade formats to standardized format
    const normalizedGrade = grade.trim().toUpperCase();

    // Handle kindergarten variations
    if (normalizedGrade === 'K' || normalizedGrade === 'KG') {
      return 'K';
    }

    // Handle numeric grades
    if (/^\d+$/.test(normalizedGrade)) {
      return normalizedGrade;
    }

    // Return as-is for other formats
    return normalizedGrade;
  }

  private getRequiredColumnsForFileType(
    fileType: InquireEdFileType,
  ): readonly string[] {
    return fileType === 'pm' ? PM_REQUIRED_COLUMNS : TE_REQUIRED_COLUMNS;
  }

  private validateRow(
    row: InquireEdProcessedRow,
    _requiredColumns: readonly string[],
    rowNumber: number,
  ): string[] {
    const errors: string[] = [];
    const prefix = `Row ${rowNumber}:`;

    // Check REQUIRED fields only (as specified by user)
    if (!row.schoolDistrict || row.schoolDistrict.trim() === '') {
      errors.push(`${prefix} Missing District or School`);
    }

    if (!row.deliveryAddress || row.deliveryAddress.trim() === '') {
      errors.push(`${prefix} Missing Delivery Address`);
    }

    if (!row.shippingContact.name || row.shippingContact.name.trim() === '') {
      errors.push(`${prefix} Missing Shipping Contact Name`);
    }

    if (!row.shippingContact.email || row.shippingContact.email.trim() === '') {
      errors.push(`${prefix} Missing Shipping Contact Email`);
    }

    // Note: Dock, Paved Path, Receiving Days, Receiving Hours are always present due to defaults
    // All other fields (Shipping Contact Phone, Delivery Notes, Earliest Delivery Date, Appointment Required) are OPTIONAL

    // Validate email format (only if provided)
    if (
      row.shippingContact.email &&
      row.shippingContact.email.trim() !== '' &&
      !this.isValidEmail(row.shippingContact.email)
    ) {
      errors.push(
        `${prefix} Invalid email format: ${row.shippingContact.email}`,
      );
    }

    // Check that row has at least one product
    if (row.products.length === 0) {
      errors.push(`${prefix} No products found`);
    }

    // Validate delivery date format (only if provided and not empty)
    if (
      row.deliveryInfo.earliestDeliveryDate &&
      row.deliveryInfo.earliestDeliveryDate.trim() !== ''
    ) {
      const isValidDate = DELIVERY_DATE_PATTERNS.some((pattern) =>
        pattern.test(row.deliveryInfo.earliestDeliveryDate),
      );
      if (!isValidDate) {
        errors.push(
          `${prefix} Invalid delivery date format: ${row.deliveryInfo.earliestDeliveryDate}`,
        );
      }
    }

    return errors;
  }

  private createKitFromRow(
    row: InquireEdProcessedRow,
    index: number,
    timestamp: Date,
  ): CustomerKit {
    const kitId = this.generateKitId(this.customerCode, index, timestamp);
    const items = this.createKitItems(kitId, row.products);

    // Parse delivery address
    const addressParts = this.parseDeliveryAddress(row.deliveryAddress);

    const kit: CustomerKit = {
      id: kitId,
      customerCode: this.customerCode,
      recipient: {
        name: row.shippingContact.name,
        company: row.schoolDistrict,
        email: row.shippingContact.email,
        phone: row.shippingContact.phone,
        address: addressParts,
      },
      items,
      metadata: {
        originalRowIndex: index,
        orderReference: row.schoolDistrict,
        customFields: {
          fileType: row.fileType,
          deliveryInfo: row.deliveryInfo,
          totalBoxes: row.totalBoxes,
          totalTEs: row.totalTEs,
        },
        shippingMethod: 'GROUND',
        specialInstructions: this.buildSpecialInstructions(row),
      },
    };

    return kit;
  }

  private parseDeliveryAddress(address: string): {
    street: string;
    street2?: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  } {
    const lines = address.split('\n').map((line) => line.trim());

    // Basic address parsing - this could be enhanced with a proper address parser
    const result = {
      street: lines[0] || '',
      street2: lines.length > 2 ? lines[1] : undefined,
      city: '',
      state: '',
      zipCode: '',
      country: 'US',
    };

    // Parse city, state, zip from last line
    const lastLine = lines[lines.length - 1];
    const cityStateZipMatch = lastLine.match(
      /^(.+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/,
    );

    if (cityStateZipMatch) {
      result.city = cityStateZipMatch[1].trim();
      result.state = cityStateZipMatch[2];
      result.zipCode = cityStateZipMatch[3];
    } else {
      // Fallback - use entire last line as city
      result.city = lastLine;
    }

    return result;
  }

  private createKitItems(
    kitId: string,
    products: Array<{
      sku: string;
      quantity: number;
      gradeLevel?: string;
      needsSticker?: boolean;
    }>,
  ): CustomerKitItem[] {
    const items: CustomerKitItem[] = [];

    products.forEach((product, index) => {
      const productInfo = this.inquireEdService.getSkuInfo(product.sku);

      const item: CustomerKitItem = {
        id: this.generateItemId(kitId, index),
        sku: product.sku,
        name: productInfo?.description || product.sku,
        description: this.buildProductDescription(product, productInfo),
        quantity: product.quantity,
        category: productInfo?.category || 'Educational Materials',
        customProperties: {
          gradeLevel: product.gradeLevel,
          needsSticker: product.needsSticker,
        },
      };

      items.push(item);
    });

    return items;
  }

  private buildProductDescription(
    product: {
      sku: string;
      quantity: number;
      gradeLevel?: string;
      needsSticker?: boolean;
    },
    productInfo?: InquireEdProductInfo,
  ): string {
    let description = productInfo?.description || product.sku;

    if (product.gradeLevel) {
      description += ` (Grade ${product.gradeLevel})`;
    }

    if (product.needsSticker !== undefined) {
      description += product.needsSticker
        ? ' - Needs Sticker'
        : ' - No Sticker';
    }

    return description;
  }

  private buildSpecialInstructions(row: InquireEdProcessedRow): string[] {
    const instructions: string[] = [];

    if (row.deliveryInfo.appointmentRequired) {
      instructions.push('APPOINTMENT REQUIRED');
    }

    if (!row.deliveryInfo.hasDock) {
      instructions.push('NO LOADING DOCK');
    }

    if (row.deliveryInfo.deliveryNotes) {
      instructions.push(row.deliveryInfo.deliveryNotes);
    }

    return instructions;
  }
}
