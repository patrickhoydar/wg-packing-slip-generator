import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse';
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
  GeorgiaBaptistFileType,
  GeorgiaBaptistProductCategories,
} from './georgia-baptist.types';

@Injectable()
export class GeorgiaBaptistStrategy extends CustomerStrategy {
  customerCode = 'GEORGIA_BAPTIST';
  displayName = 'Georgia Baptist';

  async parseFile(
    fileBuffer: Buffer,
    _filename: string,
  ): Promise<ParsedCustomerData> {
    const rawData = await this.parseCSV(fileBuffer);

    if (rawData.length === 0) {
      throw new Error('File is empty');
    }

    const headers = Object.keys(rawData[0]);
    const fileType = this.detectFileType(headers);

    if (fileType === 'unknown') {
      throw new Error(
        'Unrecognized file format. Expected UPS or POBOX format.',
      );
    }

    // Add metadata to each row
    const enrichedData = rawData.map((row, index) => ({
      ...row,
      _fileType: fileType,
      _originalIndex: index,
    }));

    return {
      rawData: enrichedData,
      metadata: {
        totalRows: rawData.length,
        columns: headers,
        customerCode: this.customerCode,
        uploadedAt: new Date(),
        fileType,
      },
    };
  }

  private async parseCSV(fileBuffer: Buffer): Promise<any[]> {
    try {
      const csvData = fileBuffer.toString().replace(/^\uFEFF/, '');
      const results: any[] = [];
      const stream = Readable.from([csvData]);

      return new Promise<any[]>((resolve, reject) => {
        stream
          .pipe(
            parse({
              columns: true,
              skip_empty_lines: true,
              delimiter: ',',
              quote: '"',
            }),
          )
          .on('data', (data) => {
            results.push(data);
          })
          .on('end', () => {
            if (results.length === 0) {
              const error = new Error('Invalid CSV data: No rows found');
              reject(error);
            }
            resolve(results);
          })
          .on('error', (error) => {
            reject(error);
          });
      });
    } catch (error) {
      throw error;
    }
  }

  async validateData(data: ParsedCustomerData): Promise<ValidationResult> {
    const result = this.createBaseValidationResult();
    result.totalRows = data.rawData.length;

    const fileType = data.metadata.fileType as GeorgiaBaptistFileType;
    const requiredFields = this.getRequiredFieldsForFileType(fileType);

    for (let i = 0; i < data.rawData.length; i++) {
      const row = data.rawData[i];
      const rowErrors = this.validateRequiredFields(row, requiredFields);

      // Additional validation for specific fields
      if (fileType === 'ups') {
        if (row.ZIPCODE && !/^\d{5}(-\d{4})?$/.test(row.ZIPCODE)) {
          rowErrors.push(`Invalid ZIP code format: ${row.ZIPCODE}`);
        }
      } else if (fileType === 'pobox') {
        if (row.ZIPCODE && !/^\d{5}(-\d{4})?$/.test(row.ZIPCODE)) {
          rowErrors.push(`Invalid ZIP code format: ${row.ZIPCODE}`);
        }
      }

      if (rowErrors.length > 0) {
        result.errors.push(
          ...rowErrors.map((error) => `Row ${i + 1}: ${error}`),
        );
      } else {
        result.validRows++;
      }
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  async generateKits(data: ParsedCustomerData): Promise<CustomerKit[]> {
    const kits: CustomerKit[] = [];
    const timestamp = new Date();

    for (let i = 0; i < data.rawData.length; i++) {
      const row = data.rawData[i];
      const fileType = row._fileType as GeorgiaBaptistFileType;

      try {
        const kit = this.createKitFromRow(row, fileType, i, timestamp);
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
      companyName: 'Georgia Baptist Mission Board',
      shouldOverrideCompany: true,
      colors: {
        primary: '#1e40af', // Blue
        secondary: '#64748b', // Gray
      },
      customStyling: {
        headerStyle: 'georgia-baptist-header',
        footerText: 'Georgia Baptist Mission Board - Sharing the Gospel',
      },
    };
  }

  getShippingRules(kit: CustomerKit): {
    method: string;
    specialHandling: boolean;
    instructions: string[];
  } {
    const isResidential = kit.shipping?.isResidential || false;

    return {
      method: kit.shipping?.service || 'GROUND',
      specialHandling: isResidential,
      instructions: isResidential
        ? ['Residential delivery', 'Signature may be required']
        : ['Commercial delivery'],
    };
  }

  getFileUploadInstructions() {
    return {
      acceptedFormats: ['csv'],
      maxFileSize: 10 * 1024 * 1024, // 10MB
      requiredColumns: [
        'COMPANY',
        'FULLNAME',
        'DELADDR',
        'CITY',
        'STATE',
        'ZIPCODE',
      ],
      sampleData: {
        ups: {
          COMPANY: 'EXAMPLE BAPTIST CHURCH',
          FULLNAME: 'JOHN DOE',
          DELADDR: '123 MAIN ST',
          CITY: 'ATLANTA',
          STATE: 'GA',
          ZIPCODE: '30309',
          PostersEng: '25',
          GuidesENG: '25',
        },
        pobox: {
          COMPANY: 'EXAMPLE BAPTIST CHURCH',
          FULLNAME: 'JOHN DOE',
          DELADDR: 'PO BOX 123',
          CITY: 'ATLANTA',
          STATE: 'GA',
          ZIPCODE: '30309',
          PostersEng: '25',
          GuidesENG: '25',
        },
      },
    };
  }

  private detectFileType(headers: string[]): GeorgiaBaptistFileType {
    const upsHeaders = [
      'RCOMPANY',
      'RADDRESS',
      'BCOMPANY',
      'SERVICE',
      'WEIGHT',
    ];
    const poboxHeaders = ['DP', 'CHKDGT', 'CRRT', 'DPV', 'URBANNAME'];

    const hasUpsHeaders = upsHeaders.some((header) => headers.includes(header));
    const hasPOBOXHeaders = poboxHeaders.some((header) =>
      headers.includes(header),
    );

    if (hasUpsHeaders) return 'ups';
    if (hasPOBOXHeaders) return 'pobox';
    return 'unknown';
  }

  private getRequiredFieldsForFileType(
    fileType: GeorgiaBaptistFileType,
  ): string[] {
    const commonFields = [
      'COMPANY',
      'FULLNAME',
      'DELADDR',
      'CITY',
      'STATE',
      'ZIPCODE',
    ];

    if (fileType === 'ups') {
      return [...commonFields];
    } else if (fileType === 'pobox') {
      return commonFields;
    }

    return commonFields;
  }

  private createKitFromRow(
    row: any,
    fileType: GeorgiaBaptistFileType,
    index: number,
    timestamp: Date,
  ): CustomerKit {
    const kitId = this.generateKitId(this.customerCode, index, timestamp);

    // Parse product quantities
    const products = this.parseProductQuantities(row);
    const items = this.createKitItems(kitId, products);

    const kit: CustomerKit = {
      id: kitId,
      customerCode: this.customerCode,
      recipient: {
        name: this.cleanString(row.FULLNAME),
        company: this.cleanString(row.COMPANY),
        email: '', // Georgia Baptist doesn't provide email in CSV
        address: {
          street: this.cleanString(row.DELADDR),
          street2: row.ALTRNT2ADD
            ? this.cleanString(row.ALTRNT2ADD)
            : undefined,
          city: this.cleanString(row.CITY),
          state: this.cleanString(row.STATE),
          zipCode: this.cleanString(row.ZIPCODE),
          country: 'US',
        },
      },
      ...(fileType === 'ups' &&
        row.RCOMPANY && {
          sender: {
            company: 'WALLACE GRAPHICS',
            address: {
              street: '123 Main St',
              city: 'Atlanta',
              state: 'GA',
              zipCode: '30309',
            },
          },
        }),
      ...(fileType === 'ups' &&
        row.BCOMPANY && {
          billing: {
            company: this.cleanString(row.BCOMPANY),
            address: {
              street: this.cleanString(row.BADDRESS),
              city: this.cleanString(row.BCITY),
              state: this.cleanString(row.BSTATE),
              zipCode: this.cleanString(row.BZIP),
            },
          },
        }),
      shipping: {
        service: fileType === 'ups' ? this.cleanString(row.SERVICE) : 'MAIL',
        weight: fileType === 'ups' ? this.parseNumber(row.WEIGHT) : undefined,
        packageCount: fileType === 'ups' ? this.parseNumber(row.PKG) : 1,
        isResidential: row.RESIDENTAL === 'Y',
        account: fileType === 'ups' ? this.cleanString(row.ACCOUNT) : undefined,
      },
      items,
      metadata: {
        originalRowIndex: index,
        orderReference:
          fileType === 'ups' ? this.cleanString(row.RFRNC1) : undefined,
        sequenceNumber:
          fileType === 'ups'
            ? this.cleanString(row.Seq)
            : this.cleanString(row.SEQ),
        customFields: {
          fileType,
          ...(fileType === 'ups' && {
            reference1: this.cleanString(row.RFRNC1),
            reference2: this.cleanString(row.RFRNC2),
            dimensions: {
              length: this.parseNumber(row.LENGTH),
              width: this.parseNumber(row.WIDTH),
              height: this.parseNumber(row.HEIGHT),
            },
          }),
        },
        shippingMethod:
          fileType === 'ups' ? this.cleanString(row.SERVICE) : 'MAIL',
        specialInstructions: [],
      },
    };

    return kit;
  }

  private parseProductQuantities(row: any): GeorgiaBaptistProductCategories {
    return {
      'posters-eng': this.parseNumber(row.PostersEng),
      'posters-spa': this.parseNumber(row.PostersSPA),
      inserts: this.parseNumber(row.Inserts),
      'guides-eng': this.parseNumber(row.GuidesENG),
      'guides-spa': this.parseNumber(row.GuidesSPA),
      envelopes: this.parseNumber(row.Envelopes),
      cards: this.parseNumber(row.Card),
    };
  }

  private createKitItems(
    kitId: string,
    products: GeorgiaBaptistProductCategories,
  ): CustomerKitItem[] {
    const items: CustomerKitItem[] = [];
    let itemIndex = 0;

    // Define the order we want items to appear on the packing slip
    const categoryOrder: (keyof GeorgiaBaptistProductCategories)[] = [
      'posters-eng',
      'posters-spa',
      'guides-eng',
      'guides-spa',
      'inserts',
      'cards',
      'envelopes',
    ];

    categoryOrder.forEach((category) => {
      const quantity = products[category];
      if (quantity > 0) {
        const item: CustomerKitItem = {
          id: this.generateItemId(kitId, itemIndex++),
          sku: this.getCategorySkuCode(category),
          name: this.getCategoryDisplayName(category),
          description: this.getCategoryDescription(category),
          quantity,
          category: category as any,
          customProperties: {},
        };
        items.push(item);
      }
    });

    return items;
  }

  private getCategorySkuCode(
    category: keyof GeorgiaBaptistProductCategories,
  ): string {
    const skuMap = {
      'posters-eng': 'GB-POSTER-ENG',
      'posters-spa': 'GB-POSTER-SPA',
      inserts: 'GB-INSERT',
      'guides-eng': 'GB-GUIDE-ENG',
      'guides-spa': 'GB-GUIDE-SPA',
      envelopes: 'GB-ENVELOPE',
      cards: 'GB-CARD',
    };
    return skuMap[category];
  }

  private getCategoryDisplayName(
    category: keyof GeorgiaBaptistProductCategories,
  ): string {
    const nameMap = {
      'posters-eng': 'Posters (English)',
      'posters-spa': 'Posters (Spanish)',
      inserts: 'Inserts',
      'guides-eng': 'Guides (English)',
      'guides-spa': 'Guides (Spanish)',
      envelopes: 'Envelopes',
      cards: 'Cards',
    };
    return nameMap[category];
  }

  private getCategoryDescription(
    category: keyof GeorgiaBaptistProductCategories,
  ): string {
    const descMap = {
      'posters-eng': 'Posters in English',
      'posters-spa': 'Posters in Spanish',
      inserts: 'Inserts',
      'guides-eng': 'Guides in English',
      'guides-spa': 'Guides in Spanish',
      envelopes: 'Envelopes',
      cards: 'Cards',
    };
    return descMap[category];
  }
}
