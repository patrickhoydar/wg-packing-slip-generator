import { Test, TestingModule } from '@nestjs/testing';
import { InquirEDStrategy } from './inquired.strategy';
import { InquirEDService } from './inquired.service';
import { CsvParserService } from '../../../common/services/csv-parser.service';
import { InquirEDProcessedRow } from './inquired.types';

describe('InquirEDStrategy', () => {
  let strategy: InquirEDStrategy;
  let csvParserService: CsvParserService;
  let inquirEDService: InquirEDService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InquirEDStrategy, InquirEDService, CsvParserService],
    }).compile();

    strategy = module.get<InquirEDStrategy>(InquirEDStrategy);
    csvParserService = module.get<CsvParserService>(CsvParserService);
    inquirEDService = module.get<InquirEDService>(InquirEDService);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should have correct customer code and display name', () => {
    expect(strategy.customerCode).toBe('INQUIRED');
    expect(strategy.displayName).toBe('InquirED');
  });

  describe('parseFile', () => {
    it('should parse PM Orders CSV file', async () => {
      const mockCsvData = `District or School,Dock?,Paved Path?,Receiving Days,Receiving Hours,Delivery Address,Shipping Contact Name,Shipping Contact Email,Shipping Contact Phone,Delivery Notes,Total Number of Boxes Ordered,IND-IJ-PM-NAVIG-EN-0100,IND-IJ-PM-NAVIG-SP-0100,Fall 2025 Earliest Delivery Date,Appointment Required?
"Test School, CO",No,Yes,Monday - Friday,8 am - 4 pm,"123 Main St
Denver, CO 80202",John Doe,john@test.edu,555-1234,Test notes,10,"2, K","1, 1",8/15/2025,No`;

      const buffer = Buffer.from(mockCsvData);
      const result = await strategy.parseFile(buffer, 'test-pm.csv');

      expect(result.rawData).toHaveLength(1);
      expect(result.metadata.fileType).toBe('pm');
      expect(result.rawData[0].schoolDistrict).toBe('Test School, CO');
      expect(result.rawData[0].products).toHaveLength(2);
      expect(result.rawData[0].products[0].sku).toBe('IND-IJ-PM-NAVIG-EN-0100');
      expect(result.rawData[0].products[0].quantity).toBe(2);
      expect(result.rawData[0].products[0].gradeLevel).toBe('K');
    });

    it('should parse TE Orders CSV file with complex sticker formats', async () => {
      const mockCsvData = `District or School,Dock?,Paved Path?,Receiving Days,Receiving Hours,Delivery Address,Shipping Contact Name,Shipping Contact Email,Shipping Contact Phone,Total Number of TEs Ordered,IND-IJ-TE-NAVIG-0100,IND-IJ-TE-MYTEAM-0200,IND-IJ-TE-PASTF-0300,Fall 2025 Earliest Delivery Date,Appointment Required?
"Test School, CO",Yes,Yes,M-F,6:30-4,"123 Main St
Denver, CO 80202",Jane Smith,jane@test.edu,555-5678,30,"30, No Sticker","25, Needs Sticker: K","26, Needs Sticker: 4",8/15/2025,Yes`;

      const buffer = Buffer.from(mockCsvData);
      const result = await strategy.parseFile(buffer, 'test-te.csv');

      expect(result.rawData).toHaveLength(1);
      expect(result.metadata.fileType).toBe('te');
      expect(result.rawData[0].schoolDistrict).toBe('Test School, CO');
      expect(result.rawData[0].products).toHaveLength(3);

      // First product: No sticker
      expect(result.rawData[0].products[0].sku).toBe('IND-IJ-TE-NAVIG-0100');
      expect(result.rawData[0].products[0].quantity).toBe(30);
      expect(result.rawData[0].products[0].needsSticker).toBe(false);
      expect(result.rawData[0].products[0].gradeLevel).toBeUndefined();

      // Second product: Needs sticker for grade K
      expect(result.rawData[0].products[1].sku).toBe('IND-IJ-TE-MYTEAM-0200');
      expect(result.rawData[0].products[1].quantity).toBe(25);
      expect(result.rawData[0].products[1].needsSticker).toBe(true);
      expect(result.rawData[0].products[1].gradeLevel).toBe('K');

      // Third product: Needs sticker for grade 4
      expect(result.rawData[0].products[2].sku).toBe('IND-IJ-TE-PASTF-0300');
      expect(result.rawData[0].products[2].quantity).toBe(26);
      expect(result.rawData[0].products[2].needsSticker).toBe(true);
      expect(result.rawData[0].products[2].gradeLevel).toBe('4');
    });

    it('should parse TE Orders with grade levels for "No Sticker" cases', async () => {
      const mockCsvData = `District or School,Dock?,Paved Path?,Receiving Days,Receiving Hours,Delivery Address,Shipping Contact Name,Shipping Contact Email,Shipping Contact Phone,Total Number of TEs Ordered,IND-IJ-TE-NAVIG-0100,IND-IJ-TE-MYTEAM-0200,Fall 2025 Earliest Delivery Date,Appointment Required?
"Test School, CO",Yes,Yes,M-F,8-4,"123 Main St
Denver, CO 80202",Jane Smith,jane@test.edu,555-5678,50,"30, No Sticker: K","20, No Sticker: 2",8/15/2025,No`;

      const buffer = Buffer.from(mockCsvData);
      const result = await strategy.parseFile(buffer, 'test-te.csv');

      expect(result.rawData).toHaveLength(1);
      expect(result.metadata.fileType).toBe('te');
      expect(result.rawData[0].products).toHaveLength(2);

      // First product: No sticker with grade K
      expect(result.rawData[0].products[0].sku).toBe('IND-IJ-TE-NAVIG-0100');
      expect(result.rawData[0].products[0].quantity).toBe(30);
      expect(result.rawData[0].products[0].needsSticker).toBe(false);
      expect(result.rawData[0].products[0].gradeLevel).toBe('K');

      // Second product: No sticker with grade 2
      expect(result.rawData[0].products[1].sku).toBe('IND-IJ-TE-MYTEAM-0200');
      expect(result.rawData[0].products[1].quantity).toBe(20);
      expect(result.rawData[0].products[1].needsSticker).toBe(false);
      expect(result.rawData[0].products[1].gradeLevel).toBe('2');
    });

    it('should throw error for empty file', async () => {
      const buffer = Buffer.from('');
      await expect(strategy.parseFile(buffer, 'empty.csv')).rejects.toThrow(
        'Invalid CSV data: No rows found',
      );
    });

    it('should throw error for unrecognized file format', async () => {
      const mockCsvData = `Invalid Column,Another Column
value1,value2`;

      const buffer = Buffer.from(mockCsvData);
      await expect(strategy.parseFile(buffer, 'invalid.csv')).rejects.toThrow(
        'Unrecognized file format',
      );
    });

    it('should handle file with custom SKU columns', async () => {
      const mockCsvData = `District or School,Dock?,Paved Path?,Receiving Days,Receiving Hours,Delivery Address,Shipping Contact Name,Shipping Contact Email,Shipping Contact Phone,Delivery Notes,Total Number of Boxes Ordered,CUSTOM-SKU-1,CUSTOM-SKU-2,ANOTHER-PRODUCT-SKU,Fall 2025 Earliest Delivery Date,Appointment Required?
"Test School, CO",No,Yes,Monday - Friday,8 am - 4 pm,"123 Main St
Denver, CO 80202",John Doe,john@test.edu,555-1234,Test notes,10,"2, K","3, 1","1, 2",8/15/2025,No`;

      const buffer = Buffer.from(mockCsvData);
      const result = await strategy.parseFile(buffer, 'test-pm.csv');

      expect(result.rawData).toHaveLength(1);
      expect(result.metadata.fileType).toBe('pm');
      expect(result.rawData[0].products).toHaveLength(3);

      // Should extract products from any non-standard SKU columns
      expect(result.rawData[0].products[0].sku).toBe('CUSTOM-SKU-1');
      expect(result.rawData[0].products[1].sku).toBe('CUSTOM-SKU-2');
      expect(result.rawData[0].products[2].sku).toBe('ANOTHER-PRODUCT-SKU');
    });

    it('should handle PM Orders with numeric grades', async () => {
      const mockCsvData = `District or School,Dock?,Paved Path?,Receiving Days,Receiving Hours,Delivery Address,Shipping Contact Name,Shipping Contact Email,Shipping Contact Phone,Delivery Notes,Total Number of Boxes Ordered,IND-IJ-PM-NAVIG-EN-0100,IND-IJ-PM-MYTEAM-EN-0200,Fall 2025 Earliest Delivery Date,Appointment Required?
"Test School, CO",No,Yes,Monday - Friday,8 am - 4 pm,"123 Main St
Denver, CO 80202",John Doe,john@test.edu,555-1234,Test notes,10,"3, 1","4, 5",8/15/2025,No`;

      const buffer = Buffer.from(mockCsvData);
      const result = await strategy.parseFile(buffer, 'test-pm.csv');

      expect(result.rawData).toHaveLength(1);
      expect(result.metadata.fileType).toBe('pm');
      expect(result.rawData[0].products).toHaveLength(2);

      // First product: Grade 1
      expect(result.rawData[0].products[0].sku).toBe('IND-IJ-PM-NAVIG-EN-0100');
      expect(result.rawData[0].products[0].quantity).toBe(3);
      expect(result.rawData[0].products[0].gradeLevel).toBe('1');

      // Second product: Grade 5
      expect(result.rawData[0].products[1].sku).toBe(
        'IND-IJ-PM-MYTEAM-EN-0200',
      );
      expect(result.rawData[0].products[1].quantity).toBe(4);
      expect(result.rawData[0].products[1].gradeLevel).toBe('5');
    });

    it('should set default shipDate to 8/7/2025 when Fall 2025 Earliest Delivery Date is empty', async () => {
      const mockCsvData = `District or School,Dock?,Paved Path?,Receiving Days,Receiving Hours,Delivery Address,Shipping Contact Name,Shipping Contact Email,Shipping Contact Phone,Delivery Notes,Total Number of Boxes Ordered,IND-IJ-PM-NAVIG-EN-0100,Fall 2025 Earliest Delivery Date,Appointment Required?
"Test School, CO",No,Yes,Monday - Friday,8 am - 4 pm,"123 Main St
Denver, CO 80202",John Doe,john@test.edu,555-1234,Test notes,10,"2, K",,No`;

      const buffer = Buffer.from(mockCsvData);
      const result = await strategy.parseFile(buffer, 'test-pm.csv');

      expect(result.rawData).toHaveLength(1);
      expect(result.rawData[0].deliveryInfo.shipDate).toBe('8/7/2025');
    });

    it('should back-date shipDate by 2 days when Fall 2025 Earliest Delivery Date has value', async () => {
      const mockCsvData = `District or School,Dock?,Paved Path?,Receiving Days,Receiving Hours,Delivery Address,Shipping Contact Name,Shipping Contact Email,Shipping Contact Phone,Delivery Notes,Total Number of Boxes Ordered,IND-IJ-PM-NAVIG-EN-0100,Fall 2025 Earliest Delivery Date,Appointment Required?
"Test School, CO",No,Yes,Monday - Friday,8 am - 4 pm,"123 Main St
Denver, CO 80202",John Doe,john@test.edu,555-1234,Test notes,10,"2, K",8/15/2025,No`;

      const buffer = Buffer.from(mockCsvData);
      const result = await strategy.parseFile(buffer, 'test-pm.csv');

      expect(result.rawData).toHaveLength(1);
      // 8/15/2025 - 2 days = 8/13/2025
      expect(result.rawData[0].deliveryInfo.shipDate).toBe('8/13/2025');
    });

    it('should handle various date formats when back-dating', async () => {
      const mockCsvData = `District or School,Dock?,Paved Path?,Receiving Days,Receiving Hours,Delivery Address,Shipping Contact Name,Shipping Contact Email,Shipping Contact Phone,Delivery Notes,Total Number of Boxes Ordered,IND-IJ-PM-NAVIG-EN-0100,Fall 2025 Earliest Delivery Date,Appointment Required?
"Test School, CO",No,Yes,Monday - Friday,8 am - 4 pm,"123 Main St
Denver, CO 80202",John Doe,john@test.edu,555-1234,Test notes,10,"2, K",09/15/2025,No`;

      const buffer = Buffer.from(mockCsvData);
      const result = await strategy.parseFile(buffer, 'test-pm.csv');

      expect(result.rawData).toHaveLength(1);
      // 9/15/2025 - 2 days = 9/13/2025
      expect(result.rawData[0].deliveryInfo.shipDate).toBe('9/13/2025');
    });

    it('should handle month boundary when back-dating (e.g., 9/1/2025 -> 8/30/2025)', async () => {
      const mockCsvData = `District or School,Dock?,Paved Path?,Receiving Days,Receiving Hours,Delivery Address,Shipping Contact Name,Shipping Contact Email,Shipping Contact Phone,Delivery Notes,Total Number of Boxes Ordered,IND-IJ-PM-NAVIG-EN-0100,Fall 2025 Earliest Delivery Date,Appointment Required?
"Test School, CO",No,Yes,Monday - Friday,8 am - 4 pm,"123 Main St
Denver, CO 80202",John Doe,john@test.edu,555-1234,Test notes,10,"2, K",9/1/2025,No`;

      const buffer = Buffer.from(mockCsvData);
      const result = await strategy.parseFile(buffer, 'test-pm.csv');

      expect(result.rawData).toHaveLength(1);
      // 9/1/2025 - 2 days = 8/30/2025
      expect(result.rawData[0].deliveryInfo.shipDate).toBe('8/30/2025');
    });
  });

  describe('validateData', () => {
    it('should validate PM Orders data successfully', async () => {
      const mockData = {
        rawData: [
          {
            schoolDistrict: 'Test School',
            deliveryAddress: '123 Main St\nDenver, CO 80202',
            shippingContact: {
              name: 'John Doe',
              email: 'john@test.edu',
              phone: '555-1234',
            },
            deliveryInfo: {
              hasDock: false,
              hasPavedPath: true,
              receivingDays: 'M-F',
              receivingHours: '8-4',
              shipDate: '8/15/2025',
              appointmentRequired: false,
            },
            products: [
              {
                sku: 'IND-IJ-PM-NAVIG-EN-0100',
                quantity: 2,
                gradeLevel: 'K',
              },
            ],
            fileType: 'pm',
            totalBoxes: 10,
          },
        ],
        metadata: {
          totalRows: 1,
          columns: ['District or School', 'Delivery Address'],
          customerCode: 'INQUIRED',
          uploadedAt: new Date(),
          fileType: 'pm',
        },
      };

      const result = await strategy.validateData(mockData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.validRows).toBe(1);
    });

    it('should fail validation for missing required fields', async () => {
      const mockData = {
        rawData: [
          {
            schoolDistrict: '',
            deliveryAddress: '',
            shippingContact: {
              name: '',
              email: 'invalid-email',
              phone: '',
            },
            deliveryInfo: {
              hasDock: false,
              hasPavedPath: true,
              receivingDays: 'M-F',
              receivingHours: '8-4',
              shipDate: '',
              appointmentRequired: false,
            },
            products: [],
            fileType: 'pm',
          },
        ],
        metadata: {
          totalRows: 1,
          columns: ['District or School'],
          customerCode: 'INQUIRED',
          uploadedAt: new Date(),
          fileType: 'pm',
        },
      };

      const result = await strategy.validateData(mockData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('Row 1: Missing District or School');
      expect(result.errors).toContain('Row 1: Missing Delivery Address');
      expect(result.errors).toContain('Row 1: Missing Shipping Contact Name');
      expect(result.errors).toContain(
        'Row 1: Invalid email format: invalid-email',
      );
      // Note: shipDate is optional, so this should not be in errors
      expect(result.errors).toContain('Row 1: No products found');
    });
  });

  describe('generateKits', () => {
    it('should generate kits from valid data', async () => {
      const mockData = {
        rawData: [
          {
            schoolDistrict: 'Test School',
            deliveryAddress: '123 Main St\nDenver, CO 80202',
            shippingContact: {
              name: 'John Doe',
              email: 'john@test.edu',
              phone: '555-1234',
            },
            deliveryInfo: {
              hasDock: false,
              hasPavedPath: true,
              receivingDays: 'M-F',
              receivingHours: '8-4',
              deliveryNotes: 'Test notes',
              shipDate: '8/15/2025',
              appointmentRequired: false,
            },
            products: [
              {
                sku: 'IND-IJ-PM-NAVIG-EN-0100',
                quantity: 2,
                gradeLevel: 'K',
              },
            ],
            fileType: 'pm',
            totalBoxes: 10,
          },
        ],
        metadata: {
          totalRows: 1,
          columns: ['District or School'],
          customerCode: 'INQUIRED',
          uploadedAt: new Date(),
          fileType: 'pm',
        },
      };

      const kits = await strategy.generateKits(mockData);

      expect(kits).toHaveLength(1);
      expect(kits[0].customerCode).toBe('INQUIRED');
      expect(kits[0].recipient.company).toBe('Test School');
      expect(kits[0].recipient.name).toBe('John Doe');
      expect(kits[0].recipient.email).toBe('john@test.edu');
      expect(kits[0].items).toHaveLength(1);
      expect(kits[0].items[0].sku).toBe('IND-IJ-PM-NAVIG-EN-0100');
      expect(kits[0].items[0].quantity).toBe(2);
      expect(kits[0].items[0].customProperties?.gradeLevel).toBe('K');
    });

    it('should skip rows with no products', async () => {
      const mockData = {
        rawData: [
          {
            schoolDistrict: 'Test School',
            deliveryAddress: '123 Main St\nDenver, CO 80202',
            shippingContact: {
              name: 'John Doe',
              email: 'john@test.edu',
              phone: '555-1234',
            },
            deliveryInfo: {
              hasDock: false,
              hasPavedPath: true,
              receivingDays: 'M-F',
              receivingHours: '8-4',
              shipDate: '8/15/2025',
              appointmentRequired: false,
            },
            products: [],
            fileType: 'pm',
            totalBoxes: 0,
          },
        ],
        metadata: {
          totalRows: 1,
          columns: ['District or School'],
          customerCode: 'INQUIRED',
          uploadedAt: new Date(),
          fileType: 'pm',
        },
      };

      const kits = await strategy.generateKits(mockData);

      expect(kits).toHaveLength(0);
    });
  });

  describe('customizeTemplate', () => {
    it('should return InquirED branding', () => {
      const mockKit = {
        id: 'test-kit',
        customerCode: 'INQUIRED',
        recipient: {
          name: 'Test',
          email: 'test@example.com',
          address: {
            street: '123 Main St',
            city: 'Denver',
            state: 'CO',
            zipCode: '80202',
            country: 'US',
          },
        },
        items: [],
        metadata: {
          originalRowIndex: 0,
          customFields: {},
          shippingMethod: 'GROUND',
          specialInstructions: [],
        },
      };

      const branding = strategy.customizeTemplate(mockKit);

      expect(branding.companyName).toBe('InquirED');
      expect(branding.shouldOverrideCompany).toBe(true);
      expect(branding.customStyling?.headerStyle).toBe('inquired-header');
      expect(branding.customStyling?.footerText).toBe(
        'InquirED Educational Materials',
      );
    });
  });

  describe('getShippingRules', () => {
    it('should return shipping rules with special instructions', () => {
      const mockKit = {
        id: 'test-kit',
        customerCode: 'INQUIRED',
        recipient: {
          name: 'Test',
          email: 'test@example.com',
          address: {
            street: '123 Main St',
            city: 'Denver',
            state: 'CO',
            zipCode: '80202',
            country: 'US',
          },
        },
        items: [],
        metadata: {
          originalRowIndex: 0,
          customFields: {
            deliveryInfo: {
              hasDock: false,
              hasPavedPath: true,
              receivingDays: 'M-F',
              receivingHours: '8-4',
              deliveryNotes: 'Test delivery notes',
              shipDate: '8/15/2025',
              appointmentRequired: true,
            },
          },
          shippingMethod: 'GROUND',
          specialInstructions: [],
        },
      };

      const rules = strategy.getShippingRules(mockKit);

      expect(rules.method).toBe('GROUND');
      expect(rules.specialHandling).toBe(true);
      expect(rules.instructions).toContain(
        'APPOINTMENT REQUIRED - Call before delivery',
      );
      expect(rules.instructions).toContain(
        'NO LOADING DOCK - Manual unloading required',
      );
      expect(rules.instructions).toContain('Receiving Hours: 8-4');
      expect(rules.instructions).toContain(
        'Special Notes: Test delivery notes',
      );
      expect(rules.instructions).toContain('Earliest Delivery: 8/15/2025');
    });
  });

  describe('getFileUploadInstructions', () => {
    it('should return file upload instructions', () => {
      const instructions = strategy.getFileUploadInstructions();

      expect(instructions.acceptedFormats).toContain('csv');
      expect(instructions.maxFileSize).toBe(10 * 1024 * 1024);
      expect(instructions.requiredColumns).toContain('District or School');
      expect(instructions.requiredColumns).toContain('Delivery Address');
      expect(instructions.sampleData.pmOrders).toBeDefined();
      expect(instructions.sampleData.teOrders).toBeDefined();
    });
  });

  describe('quantity parsing edge cases', () => {
    it('should handle malformed quantity strings gracefully', async () => {
      const mockCsvData = `District or School,Dock?,Paved Path?,Receiving Days,Receiving Hours,Delivery Address,Shipping Contact Name,Shipping Contact Email,Shipping Contact Phone,Total Number of TEs Ordered,IND-IJ-TE-NAVIG-0100,IND-IJ-TE-MYTEAM-0200,IND-IJ-TE-PASTF-0300,Fall 2025 Earliest Delivery Date,Appointment Required?
"Test School, CO",Yes,Yes,M-F,6:30-4,"123 Main St
Denver, CO 80202",Jane Smith,jane@test.edu,555-5678,30,"30","","invalid format",8/15/2025,Yes`;

      const buffer = Buffer.from(mockCsvData);
      const result = await strategy.parseFile(buffer, 'test-te.csv');

      expect(result.rawData).toHaveLength(1);
      expect(result.metadata.fileType).toBe('te');

      // Should only parse valid quantities
      expect(result.rawData[0].products).toHaveLength(1);
      expect(result.rawData[0].products[0].sku).toBe('IND-IJ-TE-NAVIG-0100');
      expect(result.rawData[0].products[0].quantity).toBe(30);
      expect(result.rawData[0].products[0].needsSticker).toBe(false);
    });

    it('should normalize grade levels correctly', async () => {
      const mockCsvData = `District or School,Dock?,Paved Path?,Receiving Days,Receiving Hours,Delivery Address,Shipping Contact Name,Shipping Contact Email,Shipping Contact Phone,Delivery Notes,Total Number of Boxes Ordered,IND-IJ-PM-NAVIG-EN-0100,IND-IJ-PM-MYTEAM-EN-0200,Fall 2025 Earliest Delivery Date,Appointment Required?
"Test School, CO",No,Yes,Monday - Friday,8 am - 4 pm,"123 Main St
Denver, CO 80202",John Doe,john@test.edu,555-1234,Test notes,10,"2, k","3, KG",8/15/2025,No`;

      const buffer = Buffer.from(mockCsvData);
      const result = await strategy.parseFile(buffer, 'test-pm.csv');

      expect(result.rawData).toHaveLength(1);
      expect(result.rawData[0].products).toHaveLength(2);

      // Both should normalize to 'K'
      expect(result.rawData[0].products[0].gradeLevel).toBe('K');
      expect(result.rawData[0].products[1].gradeLevel).toBe('K');
    });
  });

  describe('TE Packing Logic', () => {
    it('should pack single SKU with quantity <= 12 into one box', async () => {
      const mockData = {
        rawData: [
          {
            schoolDistrict: 'Test School 1',
            deliveryAddress: '123 Main St\nAnytown, NY 12345',
            shippingContact: {
              name: 'John Doe',
              email: 'john@test.com',
              phone: '123-456-7890',
            },
            deliveryInfo: {
              hasDock: true,
              hasPavedPath: true,
              receivingDays: 'M-F',
              receivingHours: '8-4',
              deliveryNotes: '',
              shipDate: '8/7/2025',
              appointmentRequired: false,
            },
            products: [
              {
                sku: 'IND-IJ-TE-NAVIG-0100',
                quantity: 10,
                gradeLevel: 'K',
                needsSticker: false,
              },
            ],
            fileType: 'te',
            totalTEs: 10,
          } as InquirEDProcessedRow,
        ],
        metadata: {
          totalRows: 1,
          columns: [],
          customerCode: 'INQUIRED',
          uploadedAt: new Date(),
          fileType: 'te',
          jobNumber: 'TEST123',
        },
      };

      const kits = await strategy.generateKits(mockData, 'TEST123');

      expect(kits).toHaveLength(1);
      expect(kits[0].metadata.customFields.boxNumber).toBe(1);
      expect(kits[0].metadata.customFields.boxesInShipment).toBe(1);
      expect(kits[0].items[0].quantity).toBe(10);
    });

    it('should pack single SKU with quantity > 12 into multiple boxes', async () => {
      const mockData = {
        rawData: [
          {
            schoolDistrict: 'Test School 2',
            deliveryAddress: '456 Oak St\nAnytown, NY 12345',
            shippingContact: {
              name: 'Jane Doe',
              email: 'jane@test.com',
              phone: '123-456-7890',
            },
            deliveryInfo: {
              hasDock: true,
              hasPavedPath: true,
              receivingDays: 'M-F',
              receivingHours: '8-4',
              deliveryNotes: '',
              shipDate: '8/7/2025',
              appointmentRequired: false,
            },
            products: [
              {
                sku: 'IND-IJ-TE-MYTEAM-0200',
                quantity: 26,
                gradeLevel: '1',
                needsSticker: true,
              },
            ],
            fileType: 'te',
            totalTEs: 26,
          } as InquirEDProcessedRow,
        ],
        metadata: {
          totalRows: 1,
          columns: [],
          customerCode: 'INQUIRED',
          uploadedAt: new Date(),
          fileType: 'te',
          jobNumber: 'TEST123',
        },
      };

      const kits = await strategy.generateKits(mockData, 'TEST123');

      expect(kits).toHaveLength(3); // 12 + 12 + 2
      expect(kits[0].metadata.customFields.boxNumber).toBe(1);
      expect(kits[0].metadata.customFields.boxesInShipment).toBe(3);
      expect(kits[0].items[0].quantity).toBe(12);
      expect(kits[1].metadata.customFields.boxNumber).toBe(2);
      expect(kits[1].items[0].quantity).toBe(12);
      expect(kits[2].metadata.customFields.boxNumber).toBe(3);
      expect(kits[2].items[0].quantity).toBe(2);
    });

    it('should not split different SKUs into the same box', async () => {
      const mockData = {
        rawData: [
          {
            schoolDistrict: 'Test School 3',
            deliveryAddress: '789 Pine St\nAnytown, NY 12345',
            shippingContact: {
              name: 'Bob Smith',
              email: 'bob@test.com',
              phone: '123-456-7890',
            },
            deliveryInfo: {
              hasDock: true,
              hasPavedPath: true,
              receivingDays: 'M-F',
              receivingHours: '8-4',
              deliveryNotes: '',
              shipDate: '8/7/2025',
              appointmentRequired: false,
            },
            products: [
              {
                sku: 'IND-IJ-TE-NAVIG-0100',
                quantity: 8,
                gradeLevel: 'K',
                needsSticker: false,
              },
              {
                sku: 'IND-IJ-TE-MYTEAM-0200',
                quantity: 6,
                gradeLevel: '1',
                needsSticker: false,
              },
            ],
            fileType: 'te',
            totalTEs: 14,
          } as InquirEDProcessedRow,
        ],
        metadata: {
          totalRows: 1,
          columns: [],
          customerCode: 'INQUIRED',
          uploadedAt: new Date(),
          fileType: 'te',
          jobNumber: 'TEST123',
        },
      };

      const kits = await strategy.generateKits(mockData, 'TEST123');

      expect(kits).toHaveLength(2); // One box per SKU
      expect(kits[0].items[0].sku).toBe('IND-IJ-TE-NAVIG-0100');
      expect(kits[0].items[0].quantity).toBe(8);
      expect(kits[1].items[0].sku).toBe('IND-IJ-TE-MYTEAM-0200');
      expect(kits[1].items[0].quantity).toBe(6);
      expect(kits[0].metadata.customFields.boxNumber).toBe(1);
      expect(kits[1].metadata.customFields.boxNumber).toBe(2);
      expect(kits[0].metadata.customFields.boxesInShipment).toBe(2);
    });

    it('should skip packing logic for exception rows (rows 2-5)', async () => {
      const mockData = {
        rawData: [
          // Row 0 (CSV row 1 after header) - should apply packing
          {
            schoolDistrict: 'Normal School',
            deliveryAddress: '100 First St\nAnytown, NY 12345',
            shippingContact: { name: 'User 1', email: '', phone: '' },
            deliveryInfo: {
              hasDock: true,
              hasPavedPath: true,
              receivingDays: 'M-F',
              receivingHours: '8-4',
              deliveryNotes: '',
              shipDate: '8/7/2025',
              appointmentRequired: false,
            },
            products: [
              {
                sku: 'IND-IJ-TE-NAVIG-0100',
                quantity: 20,
                gradeLevel: 'K',
                needsSticker: false,
              },
            ],
            fileType: 'te',
            totalTEs: 20,
          } as InquirEDProcessedRow,
          // Row 1 (CSV row 2) - exception row, should not apply packing
          {
            schoolDistrict: 'Exception School 1',
            deliveryAddress: '200 Second St\nAnytown, NY 12345',
            shippingContact: { name: 'User 2', email: '', phone: '' },
            deliveryInfo: {
              hasDock: true,
              hasPavedPath: true,
              receivingDays: 'M-F',
              receivingHours: '8-4',
              deliveryNotes: '',
              shipDate: '8/7/2025',
              appointmentRequired: false,
            },
            products: [
              {
                sku: 'IND-IJ-TE-MYTEAM-0200',
                quantity: 20,
                gradeLevel: '1',
                needsSticker: false,
              },
            ],
            fileType: 'te',
            totalTEs: 20,
          } as InquirEDProcessedRow,
          // Row 2 (CSV row 3) - exception row, should not apply packing
          {
            schoolDistrict: 'Exception School 2',
            deliveryAddress: '300 Third St\nAnytown, NY 12345',
            shippingContact: { name: 'User 3', email: '', phone: '' },
            deliveryInfo: {
              hasDock: true,
              hasPavedPath: true,
              receivingDays: 'M-F',
              receivingHours: '8-4',
              deliveryNotes: '',
              shipDate: '8/7/2025',
              appointmentRequired: false,
            },
            products: [
              {
                sku: 'IND-IJ-TE-PASTF-0300',
                quantity: 15,
                gradeLevel: '2',
                needsSticker: false,
              },
            ],
            fileType: 'te',
            totalTEs: 15,
          } as InquirEDProcessedRow,
          // Row 5 (CSV row 6) - should apply packing again
          {
            schoolDistrict: 'Normal School 2',
            deliveryAddress: '600 Sixth St\nAnytown, NY 12345',
            shippingContact: { name: 'User 6', email: '', phone: '' },
            deliveryInfo: {
              hasDock: true,
              hasPavedPath: true,
              receivingDays: 'M-F',
              receivingHours: '8-4',
              deliveryNotes: '',
              shipDate: '8/7/2025',
              appointmentRequired: false,
            },
            products: [
              {
                sku: 'IND-IJ-TE-PASTF-0300',
                quantity: 15,
                gradeLevel: '2',
                needsSticker: false,
              },
            ],
            fileType: 'te',
            totalTEs: 15,
          } as InquirEDProcessedRow,
        ],
        metadata: {
          totalRows: 4,
          columns: [],
          customerCode: 'INQUIRED',
          uploadedAt: new Date(),
          fileType: 'te',
          jobNumber: 'TEST123',
        },
      };

      const kits = await strategy.generateKits(mockData, 'TEST123');

      // Row 0: 20 items = 2 boxes (12 + 8)
      // Row 1: Exception row = 1 kit (no packing)
      // Row 2: Exception row = 1 kit (no packing)
      // Row 5: 15 items = 2 boxes (12 + 3)
      expect(kits).toHaveLength(6);

      // Check first school (row 0) - should have packing
      const row0Kits = kits.filter(
        (k) => k.recipient.company === 'Normal School',
      );
      expect(row0Kits).toHaveLength(2);
      expect(row0Kits[0].metadata.customFields.boxNumber).toBe(1);
      expect(row0Kits[0].metadata.customFields.boxesInShipment).toBe(2);

      // Check exception school (row 1) - should not have box numbers
      const row1Kits = kits.filter(
        (k) => k.recipient.company === 'Exception School 1',
      );
      expect(row1Kits).toHaveLength(1);
      expect(row1Kits[0].metadata.customFields.boxNumber).toBeUndefined();
      expect(row1Kits[0].metadata.customFields.boxesInShipment).toBeUndefined();
      expect(row1Kits[0].items[0].quantity).toBe(20); // All in one kit

      // Check exception school 2 (row 2) - should not have box numbers
      const row2Kits = kits.filter(
        (k) => k.recipient.company === 'Exception School 2',
      );
      expect(row2Kits).toHaveLength(1);
      expect(row2Kits[0].metadata.customFields.boxNumber).toBeUndefined();
      expect(row2Kits[0].metadata.customFields.boxesInShipment).toBeUndefined();
      expect(row2Kits[0].items[0].quantity).toBe(15); // All in one kit

      // Check last school (row 5) - should have packing
      const row5Kits = kits.filter(
        (k) => k.recipient.company === 'Normal School 2',
      );
      expect(row5Kits).toHaveLength(2);
      expect(row5Kits[0].metadata.customFields.boxNumber).toBe(1);
      expect(row5Kits[0].metadata.customFields.boxesInShipment).toBe(2);
    });

    it('should not apply packing logic to PM orders', async () => {
      const mockData = {
        rawData: [
          {
            schoolDistrict: 'PM Test School',
            deliveryAddress: '999 PM St\nAnytown, NY 12345',
            shippingContact: {
              name: 'PM User',
              email: 'pm@test.com',
              phone: '123-456-7890',
            },
            deliveryInfo: {
              hasDock: true,
              hasPavedPath: true,
              receivingDays: 'M-F',
              receivingHours: '8-4',
              deliveryNotes: '',
              shipDate: '8/7/2025',
              appointmentRequired: false,
            },
            products: [
              {
                sku: 'IND-IJ-PM-NAVIG-EN-0100',
                quantity: 20,
                gradeLevel: 'K',
              },
            ],
            fileType: 'pm', // PM order, not TE
            totalBoxes: 2,
          } as InquirEDProcessedRow,
        ],
        metadata: {
          totalRows: 1,
          columns: [],
          customerCode: 'INQUIRED',
          uploadedAt: new Date(),
          fileType: 'pm', // PM file type
          jobNumber: 'TEST123',
        },
      };

      const kits = await strategy.generateKits(mockData, 'TEST123');

      expect(kits).toHaveLength(1); // Only one kit, no box packing
      expect(kits[0].metadata.customFields.boxNumber).toBeUndefined();
      expect(kits[0].metadata.customFields.boxesInShipment).toBeUndefined();
      expect(kits[0].items[0].quantity).toBe(20); // All quantity in one kit
    });
  });
});
