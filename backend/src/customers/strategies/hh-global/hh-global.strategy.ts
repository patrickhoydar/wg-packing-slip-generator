import { Injectable } from '@nestjs/common';
import * as csv from 'csv-parser';
import * as XLSX from 'xlsx';
import { Readable } from 'stream';
import { CustomerStrategy } from '../base/customer-strategy.abstract';
import {
  ParsedCustomerData,
  ValidationResult,
  CustomerKit,
  CustomerBranding,
  CustomerKitItem,
} from '../base/customer-strategy.interface';
import {
  HHGlobalCSVRow,
  SEED_GUIDE_COLUMNS,
  ONE_PAGER_COLUMNS,
  REQUIRED_COLUMNS,
  HHGlobalConfig,
} from './hh-global.types';

@Injectable()
export class HHGlobalStrategy extends CustomerStrategy {
  customerCode = 'HH_GLOBAL';
  displayName = 'HH Global';

  private config: HHGlobalConfig = {
    referenceNumber: 'E03339361',
    carrierInfo: {
      name: 'Fed Ex',
      account: '339434972',
      service: 'Ground',
    },
    shippingRules: {
      smallShipmentThreshold: 12,
      smallShipmentMethod: 'FedEx Ground',
      largeShipmentMethod: 'Skip Pack - Email Weights',
    },
    branding: {
      companyName: 'HH Global',
      shouldBlindShip: true,
    },
  };

  async parseFile(
    fileBuffer: Buffer,
    filename: string,
  ): Promise<ParsedCustomerData> {
    const fileExtension = filename.toLowerCase().split('.').pop();

    let rawData: any[] = [];

    if (fileExtension === 'csv') {
      rawData = await this.parseCSV(fileBuffer);
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      rawData = await this.parseXLSX(fileBuffer);
    } else {
      throw new Error(
        'Unsupported file format. Please upload CSV or XLSX files.',
      );
    }

    return {
      rawData,
      metadata: {
        totalRows: rawData.length,
        columns: rawData.length > 0 ? Object.keys(rawData[0]) : [],
        customerCode: this.customerCode,
        uploadedAt: new Date(),
      },
    };
  }

  private async parseCSV(fileBuffer: Buffer): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const stream = Readable.from(fileBuffer);

      stream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  private async parseXLSX(fileBuffer: Buffer): Promise<any[]> {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    return XLSX.utils.sheet_to_json(worksheet);
  }

  async validateData(data: ParsedCustomerData): Promise<ValidationResult> {
    const result = this.createBaseValidationResult();
    result.totalRows = data.rawData.length;

    if (data.rawData.length === 0) {
      result.isValid = false;
      result.errors.push('No data found in uploaded file');
      return result;
    }

    // Check for required columns
    const availableColumns = data.metadata.columns;
    const missingColumns = REQUIRED_COLUMNS.filter(
      (col) => !availableColumns.includes(col),
    );

    if (missingColumns.length > 0) {
      result.isValid = false;
      result.errors.push(
        `Missing required columns: ${missingColumns.join(', ')}`,
      );
      return result;
    }

    // Validate each row
    data.rawData.forEach((row, index) => {
      const rowErrors = this.validateRow(row, index + 1);

      if (rowErrors.length > 0) {
        result.errors.push(...rowErrors);
      } else {
        result.validRows++;
      }
    });

    // Check if we have any valid rows
    if (result.validRows === 0) {
      result.isValid = false;
      result.errors.push('No valid rows found in the uploaded file');
    }

    // Warnings for missing optional data
    const hasAnyItems = data.rawData.some((row) => this.hasAnyItems(row));
    if (!hasAnyItems) {
      result.warnings.push('No seed guides or one pagers found in any rows');
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  private validateRow(row: any, rowNumber: number): string[] {
    const errors: string[] = [];
    const prefix = `Row ${rowNumber}:`;

    // Check required fields
    const requiredFieldErrors = this.validateRequiredFields(
      row,
      REQUIRED_COLUMNS,
    );
    errors.push(...requiredFieldErrors.map((err) => `${prefix} ${err}`));

    // Check that row has at least one item (seed guide or one pager)
    if (!this.hasAnyItems(row)) {
      errors.push(
        `${prefix} No items found - must have at least one seed guide or one pager`,
      );
    }

    return errors;
  }

  private hasAnyItems(row: any): boolean {
    // Check seed guides
    const hasSeedGuides = SEED_GUIDE_COLUMNS.some((col) => {
      const quantity = this.parseNumber(row[col]);
      return quantity > 0;
    });

    // Check one pagers
    const hasOnePagers = ONE_PAGER_COLUMNS.some(({ name }) => {
      const value = this.cleanString(row[name]);
      return value !== '';
    });

    return hasSeedGuides || hasOnePagers;
  }

  async generateKits(data: ParsedCustomerData): Promise<CustomerKit[]> {
    const kits: CustomerKit[] = [];
    const timestamp = new Date();

    for (let i = 0; i < data.rawData.length; i++) {
      const row = data.rawData[i];

      // Skip rows with validation errors
      if (this.validateRow(row, i + 1).length > 0) {
        continue;
      }

      const kit = await this.generateKitFromRow(row, i, timestamp);
      kits.push(kit);
    }

    return kits;
  }

  private async generateKitFromRow(
    row: HHGlobalCSVRow,
    rowIndex: number,
    timestamp: Date,
  ): Promise<CustomerKit> {
    const kitId = this.generateKitId(this.customerCode, rowIndex, timestamp);
    const items: CustomerKitItem[] = [];

    // Add seed guides
    SEED_GUIDE_COLUMNS.forEach((column, index) => {
      const quantity = this.parseNumber(row[column]);
      if (quantity > 0) {
        const stateName = this.extractStateName(column);
        items.push({
          id: this.generateItemId(kitId, items.length),
          sku: this.extractSKU(column),
          name: `${stateName} Seed Guide`,
          description: `Seed guide for ${stateName} region`,
          quantity,
          category: 'seed-guide',
          customProperties: {
            state: stateName,
            region: this.getRegionFromColumn(column),
          },
        });
      }
    });

    // Add one pagers
    ONE_PAGER_COLUMNS.forEach(({ name, qc }, index) => {
      const onePagerName = this.cleanString(row[name]);
      const qcNumber = this.cleanString(row[qc]);

      if (onePagerName) {
        items.push({
          id: this.generateItemId(kitId, items.length),
          sku: qcNumber || `OP-${index + 1}`,
          name: onePagerName,
          description: `One pager collateral sheet`,
          quantity: 1,
          category: 'collateral',
          customProperties: {
            qcNumber,
            onePagerSlot: index + 1,
          },
        });
      }
    });

    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const estimatedCartons = Math.ceil(totalQuantity / 50); // Estimate based on quantity

    return {
      id: kitId,
      customerCode: this.customerCode,
      recipient: {
        name: this.cleanString(row['Shipment too']) || 'Unknown Recipient',
        email: this.cleanString(row['Recipient Email']) || '',
        address: {
          street: this.cleanString(row['Address']),
          city: this.cleanString(row['City']),
          state: this.cleanString(row['State']),
          zipCode: this.cleanString(row['Zip']),
          country: 'USA',
        },
      },
      items,
      metadata: {
        originalRowIndex: rowIndex,
        customFields: {
          referenceNumber: this.config.referenceNumber,
          carrierAccount: this.config.carrierInfo.account,
          estimatedCartons,
        },
        shippingMethod: this.determineShippingMethod(estimatedCartons),
        specialInstructions: this.getSpecialInstructions(estimatedCartons),
      },
    };
  }

  private extractStateName(column: string): string {
    return column.split(' Seed Guide')[0];
  }

  private extractSKU(column: string): string {
    const match = column.match(/([A-Z0-9]+)$/);
    return match ? match[1] : 'UNKNOWN';
  }

  private getRegionFromColumn(column: string): string {
    if (column.includes(';')) {
      return column.split(' Seed Guide')[0];
    }
    return this.extractStateName(column);
  }

  private determineShippingMethod(estimatedCartons: number): string {
    return estimatedCartons < this.config.shippingRules.smallShipmentThreshold
      ? this.config.shippingRules.smallShipmentMethod
      : this.config.shippingRules.largeShipmentMethod;
  }

  private getSpecialInstructions(estimatedCartons: number): string[] {
    const instructions: string[] = [
      'SHIP IN THE NAME OF HH GLOBAL, OR BLIND',
      'DO NOT SHOW WALLACE GRAPHICS AS THE SHIPPER',
      `Reference #1: ${this.config.referenceNumber}`,
    ];

    if (estimatedCartons >= this.config.shippingRules.smallShipmentThreshold) {
      instructions.push('PLEASE SKIP PACK AND EMAIL WEIGHTS AND DIMS TO TRACY');
    }

    instructions.push('Treat each row of the spreadsheet as a separate kit');
    instructions.push(
      'Label seed guides by version, collateral sheets per descriptions',
    );

    return instructions;
  }

  customizeTemplate(kit: CustomerKit): CustomerBranding {
    return {
      companyName: this.config.branding.companyName,
      shouldOverrideCompany: this.config.branding.shouldBlindShip,
      customStyling: {
        referenceNumber: kit.metadata.customFields.referenceNumber,
        carrierInfo: this.config.carrierInfo,
        specialInstructions: kit.metadata.specialInstructions,
      },
    };
  }

  getShippingRules(kit: CustomerKit) {
    const estimatedCartons = kit.metadata.customFields.estimatedCartons || 0;

    return {
      method:
        kit.metadata.shippingMethod ||
        this.config.shippingRules.smallShipmentMethod,
      specialHandling:
        estimatedCartons >= this.config.shippingRules.smallShipmentThreshold,
      instructions: kit.metadata.specialInstructions || [],
    };
  }

  getFileUploadInstructions() {
    return {
      acceptedFormats: ['csv', 'xlsx'],
      maxFileSize: 10 * 1024 * 1024, // 10MB
      requiredColumns: [...REQUIRED_COLUMNS],
      sampleData: {
        description:
          'Each row represents one kit to be shipped to one recipient',
        columns: {
          Address: 'Recipient street address',
          City: 'Recipient city',
          State: 'Recipient state (2-letter code)',
          Zip: 'Recipient ZIP code',
          'Recipient Email': 'Recipient email address (optional)',
          'Seed Guides': 'Quantity columns for each state (15 variations)',
          'One Pagers': 'Name and QC number for custom collateral (3 slots)',
        },
        specialNotes: [
          'Email address is optional for recipients',
          'Leave quantity columns empty or 0 if not needed',
          'Each row becomes a separate packing slip',
          'Shipments under 12 cartons will be FedEx Ground',
          'Shipments 12+ cartons require special handling',
        ],
      },
    };
  }
}
