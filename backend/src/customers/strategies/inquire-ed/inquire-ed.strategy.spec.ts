import { Test, TestingModule } from '@nestjs/testing';
import { InquireEdStrategy } from './inquire-ed.strategy';
import { InquireEdService } from './inquire-ed.service';
import { CsvParserService } from '../../../common/services/csv-parser.service';

describe('InquireEdStrategy', () => {
  let strategy: InquireEdStrategy;
  let csvParserService: CsvParserService;
  let inquireEdService: InquireEdService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InquireEdStrategy, InquireEdService, CsvParserService],
    }).compile();

    strategy = module.get<InquireEdStrategy>(InquireEdStrategy);
    csvParserService = module.get<CsvParserService>(CsvParserService);
    inquireEdService = module.get<InquireEdService>(InquireEdService);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should have correct customer code and display name', () => {
    expect(strategy.customerCode).toBe('INQUIRE_ED');
    expect(strategy.displayName).toBe('InquireEd');
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

    it('should throw error for empty file', async () => {
      const buffer = Buffer.from('');
      await expect(strategy.parseFile(buffer, 'empty.csv')).rejects.toThrow('Invalid CSV data: No rows found');
    });

    it('should throw error for unrecognized file format', async () => {
      const mockCsvData = `Invalid Column,Another Column
value1,value2`;

      const buffer = Buffer.from(mockCsvData);
      await expect(strategy.parseFile(buffer, 'invalid.csv')).rejects.toThrow('Unrecognized file format');
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
      expect(result.rawData[0].products[1].sku).toBe('IND-IJ-PM-MYTEAM-EN-0200');
      expect(result.rawData[0].products[1].quantity).toBe(4);
      expect(result.rawData[0].products[1].gradeLevel).toBe('5');
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
              earliestDeliveryDate: '8/15/2025',
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
          customerCode: 'INQUIRE_ED',
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
              earliestDeliveryDate: '',
              appointmentRequired: false,
            },
            products: [],
            fileType: 'pm',
          },
        ],
        metadata: {
          totalRows: 1,
          columns: ['District or School'],
          customerCode: 'INQUIRE_ED',
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
      expect(result.errors).toContain('Row 1: Invalid email format: invalid-email');
      // Note: Earliest Delivery Date is optional, so this should not be in errors
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
              earliestDeliveryDate: '8/15/2025',
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
          customerCode: 'INQUIRE_ED',
          uploadedAt: new Date(),
          fileType: 'pm',
        },
      };

      const kits = await strategy.generateKits(mockData);

      expect(kits).toHaveLength(1);
      expect(kits[0].customerCode).toBe('INQUIRE_ED');
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
              earliestDeliveryDate: '8/15/2025',
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
          customerCode: 'INQUIRE_ED',
          uploadedAt: new Date(),
          fileType: 'pm',
        },
      };

      const kits = await strategy.generateKits(mockData);

      expect(kits).toHaveLength(0);
    });
  });

  describe('customizeTemplate', () => {
    it('should return InquireEd branding', () => {
      const mockKit = {
        id: 'test-kit',
        customerCode: 'INQUIRE_ED',
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

      expect(branding.companyName).toBe('InquireEd');
      expect(branding.shouldOverrideCompany).toBe(true);
      expect(branding.customStyling?.headerStyle).toBe('inquire-ed-header');
      expect(branding.customStyling?.footerText).toBe('InquireEd Educational Materials');
    });
  });

  describe('getShippingRules', () => {
    it('should return shipping rules with special instructions', () => {
      const mockKit = {
        id: 'test-kit',
        customerCode: 'INQUIRE_ED',
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
              earliestDeliveryDate: '8/15/2025',
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
      expect(rules.instructions).toContain('APPOINTMENT REQUIRED - Call before delivery');
      expect(rules.instructions).toContain('NO LOADING DOCK - Manual unloading required');
      expect(rules.instructions).toContain('Receiving Hours: 8-4');
      expect(rules.instructions).toContain('Special Notes: Test delivery notes');
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
});