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
import { InquirEDService } from './inquire-ed.service';
import {
  InquirEDRow,
  InquirEDPMRow,
  InquirEDTERow,
  InquirEDFileType,
  InquirEDProcessedRow,
  InquirEDProductInfo,
  InquirEDDeliveryInfo,
  InquirEDShippingContact,
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
export class InquirEDStrategy extends CustomerStrategy {
  customerCode = 'INQUIRE_ED';
  displayName = 'InquirED';

  constructor(
    private csvParser: CsvParserService,
    private inquirEDService: InquirEDService,
  ) {
    super();
    this.inquirEDService.loadSkuLookupTable();
  }

  async parseFile(
    fileBuffer: Buffer,
    filename: string,
  ): Promise<ParsedCustomerData> {
    const parseResult = await this.csvParser.parseCSV<InquirEDRow>(fileBuffer);

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

    const fileType = data.metadata.fileType as InquirEDFileType;
    const requiredColumns = this.getRequiredColumnsForFileType(fileType);

    // Validate each row
    for (let i = 0; i < data.rawData.length; i++) {
      const row = data.rawData[i] as InquirEDProcessedRow;
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
      (row: InquirEDProcessedRow) => row.products.length === 0,
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
      const row = data.rawData[i] as InquirEDProcessedRow;

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

    // Post-process kits to calculate shipDates for orders
    console.log(
      `[EARLIEST-DELIVERY] InquirED: Generated ${kits.length} kits, starting shipDate calculation`,
    );
    this.calculateOrdershipDates(kits);

    return kits;
  }

  customizeTemplate(kit: CustomerKit): CustomerBranding {
    return {
      companyName: 'InquirED',
      shouldOverrideCompany: true,
      colors: {
        primary: '#2563eb', // Blue
        secondary: '#64748b', // Gray
      },
      customStyling: {
        headerStyle: 'inquire-ed-header',
        footerText: 'InquirED Educational Materials',
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
      .deliveryInfo as InquirEDDeliveryInfo;
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

    // Add shipDate
    if (deliveryInfo.shipDate) {
      instructions.push(`Earliest Delivery: ${deliveryInfo.shipDate}`);
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

  private detectFileType(columns: string[]): InquirEDFileType | 'unknown' {
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
    console.log('InquirED File Type Detection:');
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
    row: InquirEDRow,
    fileType: InquirEDFileType,
    _index: number,
  ): InquirEDProcessedRow {
    const schoolDistrict = this.csvParser.cleanString(
      row['District or School'],
    );
    const deliveryAddress = this.csvParser.cleanString(row['Delivery Address']);

    const shippingContact: InquirEDShippingContact = {
      name: this.csvParser.cleanString(row['Shipping Contact Name']),
      email: this.csvParser.cleanString(row['Shipping Contact Email']),
      phone: this.csvParser.cleanString(row['Shipping Contact Phone']),
    };

    const receivingHours = this.csvParser.cleanString(row['Receiving Hours']);
    const appointmentRequiredFromCSV =
      this.csvParser.cleanString(row['Appointment Required?']).toLowerCase() ===
      'yes';

    const deliveryInfo: InquirEDDeliveryInfo = {
      hasDock: this.csvParser.cleanString(row['Dock?']).toLowerCase() === 'yes',
      hasPavedPath:
        this.csvParser.cleanString(row['Paved Path?']).toLowerCase() === 'yes',
      receivingDays: this.csvParser.cleanString(row['Receiving Days']) || 'M-F',
      receivingHours: receivingHours || 'N/A',
      deliveryNotes: this.csvParser.cleanString(row['Delivery Notes']),
      shipDate: this.calculateShipDate(
        this.csvParser.cleanString(row['Fall 2025 Earliest Delivery Date']),
      ),
      appointmentRequired: !receivingHours ? true : appointmentRequiredFromCSV,
    };

    const products = this.extractProducts(row, fileType);

    const result: InquirEDProcessedRow = {
      schoolDistrict,
      deliveryAddress,
      shippingContact,
      deliveryInfo,
      products,
      fileType,
    };

    if (fileType === 'pm') {
      result.totalBoxes = this.parseNumber(
        (row as InquirEDPMRow)['Total Number of Boxes Ordered'],
      );
    } else {
      result.totalTEs = this.parseNumber(
        (row as InquirEDTERow)['Total Number of TEs Ordered'],
      );
    }

    return result;
  }

  private extractProducts(
    row: InquirEDRow,
    fileType: InquirEDFileType,
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
    fileType: InquirEDFileType,
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
    fileType: InquirEDFileType,
  ): readonly string[] {
    return fileType === 'pm' ? PM_REQUIRED_COLUMNS : TE_REQUIRED_COLUMNS;
  }

  private validateRow(
    row: InquirEDProcessedRow,
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

    // if (!row.shippingContact.email || row.shippingContact.email.trim() === '') {
    //   errors.push(`${prefix} Missing Shipping Contact Email`);
    // }

    // Note: Dock, Paved Path, Receiving Days, Receiving Hours are always present due to defaults
    // All other fields (Shipping Contact Phone, Delivery Notes, shipDate, Appointment Required) are OPTIONAL

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
    if (row.deliveryInfo.shipDate && row.deliveryInfo.shipDate.trim() !== '') {
      const isValidDate = DELIVERY_DATE_PATTERNS.some((pattern) =>
        pattern.test(row.deliveryInfo.shipDate),
      );
      if (!isValidDate) {
        errors.push(
          `${prefix} Invalid delivery date format: ${row.deliveryInfo.shipDate}`,
        );
      }
    }

    return errors;
  }

  private createKitFromRow(
    row: InquirEDProcessedRow,
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

  /**
   * Calculate and set shipDates.
   * Find the earliest date from all kits and apply it to kits missing delivery dates.
   */
  private calculateOrdershipDates(kits: CustomerKit[]): void {
    console.log(
      `[EARLIEST-DELIVERY] InquirED: Processing ${kits.length} kits for shipDate calculation`,
    );

    // Find the earliest date from ALL kits that have dates
    let earliestDate: string | null = null;
    let kitsWithDates = 0;
    let kitsWithoutDates = 0;

    for (const kit of kits) {
      const deliveryInfo = kit.metadata.customFields.deliveryInfo;
      if (deliveryInfo.shipDate && deliveryInfo.shipDate.trim() !== '') {
        kitsWithDates++;
        const currentDate = deliveryInfo.shipDate.trim();
        if (!earliestDate || this.isDateEarlier(currentDate, earliestDate)) {
          earliestDate = currentDate;
        }
      } else {
        kitsWithoutDates++;
      }
    }

    console.log(
      `[EARLIEST-DELIVERY] Analysis: ${kitsWithDates} kits with dates, ${kitsWithoutDates} kits without dates`,
    );
    console.log(
      `[EARLIEST-DELIVERY] Earliest date found across all kits: "${earliestDate}"`,
    );

    // If no earliest date found, use default date
    if (!earliestDate) {
      earliestDate = '8/7/2025';
      console.log(
        `[EARLIEST-DELIVERY] No dates found in any kits, using default date: ${earliestDate}`,
      );
    }

    // Apply earliest date to any kits missing delivery dates
    if (earliestDate && kitsWithoutDates > 0) {
      let updatedCount = 0;
      for (const kit of kits) {
        const deliveryInfo = kit.metadata.customFields.deliveryInfo;
        if (!deliveryInfo.shipDate || deliveryInfo.shipDate.trim() === '') {
          console.log(
            `[EARLIEST-DELIVERY] UPDATING kit ${kit.id} (${kit.recipient.company}) from "" to "${earliestDate}"`,
          );
          deliveryInfo.shipDate = earliestDate;
          updatedCount++;
        }
      }
      console.log(
        `[EARLIEST-DELIVERY] Updated ${updatedCount} kits with earliest date: ${earliestDate}`,
      );
    }

    // Final verification
    console.log(
      `[EARLIEST-DELIVERY] Final verification - all ${kits.length} kits after calculation:`,
    );
    for (const kit of kits) {
      const deliveryInfo = kit.metadata.customFields.deliveryInfo;
      console.log(
        `[EARLIEST-DELIVERY] Final: Kit ${kit.id} (${kit.recipient.company}) shipDate: "${deliveryInfo.shipDate}"`,
      );
    }
  }

  /**
   * Compare two date strings to determine if first date is earlier than second
   * Assumes dates are in MM/DD/YYYY format
   */
  private isDateEarlier(date1: string, date2: string): boolean {
    try {
      const d1 = new Date(date1);
      const d2 = new Date(date2);
      return d1 < d2;
    } catch (error) {
      // If date parsing fails, fallback to string comparison
      return date1 < date2;
    }
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
      const productInfo = this.inquirEDService.getSkuInfo(product.sku);

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
          productCategory: productInfo?.category,
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
    productInfo?: InquirEDProductInfo,
  ): string {
    let description = productInfo?.description || product.sku;

    // Remove the full language from the description, as it's now in the category
    description = description
      .replace(/\s\(English\)/, '')
      .replace(/\s\(Spanish\)/, '');

    if (product.needsSticker !== undefined) {
      description += product.needsSticker
        ? ' - Needs Sticker'
        : ' - No Sticker';
    }

    return description;
  }

  private buildSpecialInstructions(row: InquirEDProcessedRow): string[] {
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

  /**
   * Convert delivery date to ship date by subtracting 2 days
   * If no delivery date provided, returns default ship date of 8/7/2025
   */
  private calculateShipDate(deliveryDateString: string): string {
    const cleanedDate = deliveryDateString?.trim();

    // If no date provided, return default
    if (!cleanedDate) {
      return '8/7/2025';
    }

    try {
      // Parse the date string - handle various formats
      let parsedDate: Date;

      // Try MM/DD/YYYY format first (most common)
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleanedDate)) {
        parsedDate = new Date(cleanedDate);
      }
      // Try MM/DD/YY format
      else if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(cleanedDate)) {
        parsedDate = new Date(cleanedDate);
      }
      // Try YYYY-MM-DD format
      else if (/^\d{4}-\d{2}-\d{2}$/.test(cleanedDate)) {
        parsedDate = new Date(cleanedDate);
      }
      // Try MM-DD-YYYY format
      else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(cleanedDate)) {
        const parts = cleanedDate.split('-');
        parsedDate = new Date(`${parts[0]}/${parts[1]}/${parts[2]}`);
      } else {
        // Fallback: try direct parsing
        parsedDate = new Date(cleanedDate);
      }

      // Check if date is valid
      if (isNaN(parsedDate.getTime())) {
        console.warn(
          `Invalid date format: ${cleanedDate}, using default ship date`,
        );
        return '8/7/2025';
      }

      // Subtract 2 days
      parsedDate.setDate(parsedDate.getDate() - 2);

      // Format back to MM/DD/YYYY
      const month = (parsedDate.getMonth() + 1).toString();
      const day = parsedDate.getDate().toString();
      const year = parsedDate.getFullYear().toString();

      return `${month}/${day}/${year}`;
    } catch (error) {
      console.warn(
        `Error parsing date: ${cleanedDate}, using default ship date`,
        error,
      );
      return '8/7/2025';
    }
  }
}
