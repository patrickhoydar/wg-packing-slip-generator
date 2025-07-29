import { Test, TestingModule } from '@nestjs/testing';
import { CsvParserService } from './csv-parser.service';

describe('CsvParserService', () => {
  let service: CsvParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CsvParserService],
    }).compile();

    service = module.get<CsvParserService>(CsvParserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Excel Date Conversion Detection and Fixing', () => {
    describe('detectExcelDateConversion', () => {
      it('should detect Excel date conversions', () => {
        const testCases = [
          { input: '4-Sep', expected: true, fixedValue: '4-9' },
          { input: '12-Dec', expected: true, fixedValue: '12-12' },
          { input: '1-Jan', expected: true, fixedValue: '1-1' },
          { input: '15-Mar', expected: true, fixedValue: '15-3' },
          { input: '31-Oct', expected: true, fixedValue: '31-10' },
        ];

        testCases.forEach(({ input, expected, fixedValue }) => {
          const result = service.detectExcelDateConversion(input);
          expect(result.isExcelDate).toBe(expected);
          expect(result.fixedValue).toBe(fixedValue);
          expect(result.originalValue).toBe(input);
        });
      });

      it('should handle AM/PM indicators', () => {
        const testCases = [
          { input: '4-Sep am', expected: true, fixedValue: '4-9 am' },
          { input: '12-Dec PM', expected: true, fixedValue: '12-12 PM' },
          { input: '8-Aug AM', expected: true, fixedValue: '8-8 AM' },
        ];

        testCases.forEach(({ input, expected, fixedValue }) => {
          const result = service.detectExcelDateConversion(input);
          expect(result.isExcelDate).toBe(expected);
          expect(result.fixedValue).toBe(fixedValue);
        });
      });

      it('should not detect non-Excel date formats', () => {
        const testCases = [
          '8 am - 4 pm',
          '8-4',
          '9-5',
          'Monday - Friday',
          'M-F',
          '',
          'N/A',
          '8:00 - 17:00',
        ];

        testCases.forEach((input) => {
          const result = service.detectExcelDateConversion(input);
          expect(result.isExcelDate).toBe(false);
          expect(result.originalValue).toBe(input);
          expect(result.fixedValue).toBeUndefined();
        });
      });

      it('should handle case insensitivity', () => {
        const testCases = [
          { input: '4-SEP', expected: true, fixedValue: '4-9' },
          { input: '12-dec', expected: true, fixedValue: '12-12' },
          { input: '1-JaN', expected: true, fixedValue: '1-1' },
        ];

        testCases.forEach(({ input, expected, fixedValue }) => {
          const result = service.detectExcelDateConversion(input);
          expect(result.isExcelDate).toBe(expected);
          expect(result.fixedValue).toBe(fixedValue);
        });
      });
    });

    describe('fixExcelDateConversion', () => {
      it('should fix Excel date conversions', () => {
        expect(service.fixExcelDateConversion('4-Sep')).toBe('4-9');
        expect(service.fixExcelDateConversion('12-Dec')).toBe('12-12');
        expect(service.fixExcelDateConversion('1-Jan')).toBe('1-1');
      });

      it('should preserve non-Excel date values', () => {
        expect(service.fixExcelDateConversion('8 am - 4 pm')).toBe('8 am - 4 pm');
        expect(service.fixExcelDateConversion('8-4')).toBe('8-4');
        expect(service.fixExcelDateConversion('M-F')).toBe('M-F');
      });

      it('should handle empty values', () => {
        expect(service.fixExcelDateConversion('')).toBe('');
        expect(service.fixExcelDateConversion(null as any)).toBe(null);
        expect(service.fixExcelDateConversion(undefined as any)).toBe(undefined);
      });
    });

    describe('detectExcelDateConversionsInRow', () => {
      it('should detect conversions in specified columns', () => {
        const row = {
          'District or School': 'Test School',
          'Receiving Hours': '4-Sep',
          'Receiving Days': 'M-F',
          'Other Field': '12-Dec',
        };

        const conversions = service.detectExcelDateConversionsInRow(row, [
          'Receiving Hours',
        ]);

        expect(conversions).toHaveLength(1);
        expect(conversions[0].isExcelDate).toBe(true);
        expect(conversions[0].originalValue).toBe('4-Sep');
        expect(conversions[0].fixedValue).toBe('4-9');
        expect(conversions[0].detectedPattern).toContain('Receiving Hours');
      });

      it('should check multiple columns', () => {
        const row = {
          'Receiving Hours': '4-Sep',
          'Delivery Hours': '8-Aug am',
          'Other Hours': '9-5',
        };

        const conversions = service.detectExcelDateConversionsInRow(row, [
          'Receiving Hours',
          'Delivery Hours',
          'Other Hours',
        ]);

        expect(conversions).toHaveLength(2);
        expect(conversions[0].originalValue).toBe('4-Sep');
        expect(conversions[1].originalValue).toBe('8-Aug am');
      });

      it('should handle missing columns gracefully', () => {
        const row = {
          'District or School': 'Test School',
        };

        const conversions = service.detectExcelDateConversionsInRow(row, [
          'Receiving Hours',
          'Non-existent Column',
        ]);

        expect(conversions).toHaveLength(0);
      });
    });
  });

  describe('CSV Parsing Edge Cases', () => {
    it('should parse CSV with Excel date conversions', async () => {
      const csvContent = `District or School,Receiving Hours,Receiving Days
"Test School 1","4-Sep","M-F"
"Test School 2","8 am - 4 pm","Monday - Friday"
"Test School 3","12-Dec PM","M-F"`;

      const buffer = Buffer.from(csvContent);
      const result = await service.parseCSV(buffer);

      expect(result.data).toHaveLength(3);
      expect(result.data[0]['Receiving Hours']).toBe('4-Sep');
      expect(result.data[1]['Receiving Hours']).toBe('8 am - 4 pm');
      expect(result.data[2]['Receiving Hours']).toBe('12-Dec PM');
    });
  });
});