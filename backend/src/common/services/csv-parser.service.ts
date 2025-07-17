import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse';
import { Readable } from 'stream';

export interface CsvParseOptions {
  delimiter?: string;
  quote?: string;
  escape?: string;
  columns?: boolean | string[];
  skip_empty_lines?: boolean;
  skip_records_with_empty_values?: boolean;
  skip_records_with_error?: boolean;
  trim?: boolean;
  ltrim?: boolean;
  rtrim?: boolean;
  auto_parse?: boolean;
  auto_parse_date?: boolean;
  cast?: boolean;
  cast_date?: boolean;
  comment?: string;
  ignore_last_delimiters?: boolean;
  max_record_size?: number;
  relax_column_count?: boolean;
  relax_quotes?: boolean;
  skip_lines_with_error?: boolean;
}

export interface CsvParseResult<T = any> {
  data: T[];
  errors: Array<{
    row: number;
    column: number;
    message: string;
  }>;
  metadata: {
    totalRows: number;
    columns: string[];
    encoding: string;
    hasBOM: boolean;
    parseTime: number;
  };
}

@Injectable()
export class CsvParserService {
  /**
   * Parse CSV data from a buffer with comprehensive error handling
   * @param fileBuffer - Buffer containing CSV data
   * @param options - CSV parsing options
   * @returns Promise<CsvParseResult>
   */
  async parseCSV<T = any>(
    fileBuffer: Buffer,
    options: CsvParseOptions = {},
  ): Promise<CsvParseResult<T>> {
    const startTime = Date.now();
    
    // Default options (for reference, using inline options below)
    // const defaultOptions: CsvParseOptions = {
    //   columns: true,
    //   skip_empty_lines: true,
    //   delimiter: ',',
    //   quote: '"',
    //   trim: true,
    //   relax_column_count: true,
    //   relax_quotes: true,
    //   ...options,
    // };

    // Handle BOM (Byte Order Mark) and encoding issues - simplified approach
    const csvData = fileBuffer.toString().replace(/^\uFEFF/, '');
    const results: T[] = [];
    const errors: Array<{ row: number; column: number; message: string }> = [];
    let columns: string[] = [];

    console.log('CSV Parser: Starting parsing with simplified approach');

    return new Promise<CsvParseResult<T>>((resolve, reject) => {
      const stream = Readable.from([csvData]);

      stream
        .pipe(
          parse({
            columns: true,
            skip_empty_lines: true,
            delimiter: ',',
            quote: '"',
            trim: true,
            relax_column_count: true,
            relax_quotes: true,
            ...options,
          }),
        )
        .on('data', (data: T) => {
          // Capture column names from first record
          if (results.length === 0 && typeof data === 'object' && data !== null) {
            columns = Object.keys(data);
            console.log('CSV Parser: Captured columns from first data record:', columns);
          }
          results.push(data);
        })
        .on('error', (error: any) => {
          console.error('CSV Parser: Error during parsing:', error);
          errors.push({ 
            row: error.record || 0, 
            column: error.column || 0, 
            message: error.message || 'Unknown parsing error' 
          });
        })
        .on('end', () => {
          const parseTime = Date.now() - startTime;
          console.log('CSV Parser: Parsing completed, results:', results.length, 'columns:', columns);
          
          if (results.length === 0) {
            reject(new Error('Invalid CSV data: No rows found'));
            return;
          }

          resolve({
            data: results,
            errors,
            metadata: {
              totalRows: results.length,
              columns,
              encoding: 'utf8',
              hasBOM: fileBuffer.toString().startsWith('\uFEFF'),
              parseTime,
            },
          });
        });
    });
  }

  /**
   * Parse CSV data with strict validation (throws on any error)
   * @param fileBuffer - Buffer containing CSV data
   * @param options - CSV parsing options
   * @returns Promise<T[]>
   */
  async parseCSVStrict<T = any>(
    fileBuffer: Buffer,
    options: CsvParseOptions = {},
  ): Promise<T[]> {
    const result = await this.parseCSV<T>(fileBuffer, options);
    
    if (result.errors.length > 0) {
      throw new Error(
        `CSV parsing errors: ${result.errors.map(e => `Row ${e.row}: ${e.message}`).join(', ')}`,
      );
    }
    
    return result.data;
  }

  /**
   * Validate CSV structure against expected columns
   * @param data - Parsed CSV data
   * @param requiredColumns - Array of required column names
   * @param optionalColumns - Array of optional column names
   * @returns Validation result
   */
  validateCsvStructure(
    data: any[],
    requiredColumns: string[],
    optionalColumns: string[] = [],
  ): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    availableColumns: string[];
    missingColumns: string[];
    extraColumns: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!data || data.length === 0) {
      errors.push('No data found in CSV file');
      return {
        isValid: false,
        errors,
        warnings,
        availableColumns: [],
        missingColumns: requiredColumns,
        extraColumns: [],
      };
    }

    const availableColumns = Object.keys(data[0]);
    const allExpectedColumns = [...requiredColumns, ...optionalColumns];
    
    // Check for missing required columns
    const missingColumns = requiredColumns.filter(
      col => !availableColumns.includes(col),
    );
    
    if (missingColumns.length > 0) {
      errors.push(`Missing required columns: ${missingColumns.join(', ')}`);
    }

    // Check for extra columns (not necessarily an error, but worth noting)
    const extraColumns = availableColumns.filter(
      col => !allExpectedColumns.includes(col),
    );
    
    if (extraColumns.length > 0) {
      warnings.push(`Extra columns found: ${extraColumns.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      availableColumns,
      missingColumns,
      extraColumns,
    };
  }

  /**
   * Clean CSV data by removing BOM and handling encoding issues
   * @param fileBuffer - Raw file buffer
   * @returns Cleaned data with metadata
   */
  private cleanCsvData(fileBuffer: Buffer): {
    cleanedData: string;
    hasBOM: boolean;
    encoding: string;
  } {
    let csvData = fileBuffer.toString('utf8');
    let hasBOM = false;
    let encoding = 'utf8';

    // Check for and remove BOM (Byte Order Mark)
    if (csvData.charCodeAt(0) === 0xfeff) {
      csvData = csvData.slice(1);
      hasBOM = true;
    }

    // Handle other common BOM patterns
    if (csvData.startsWith('\ufeff')) {
      csvData = csvData.replace(/^\ufeff/, '');
      hasBOM = true;
    }

    // Try to detect encoding issues and handle them
    try {
      // Check if the data is valid UTF-8
      const testBuffer = Buffer.from(csvData, 'utf8');
      if (testBuffer.toString('utf8') !== csvData) {
        // Try alternative encodings
        const alternativeEncodings = ['latin1', 'ascii', 'utf16le'];
        for (const enc of alternativeEncodings) {
          try {
            const testData = fileBuffer.toString(enc as BufferEncoding);
            if (testData && testData.length > 0) {
              csvData = testData;
              encoding = enc;
              break;
            }
          } catch (e) {
            // Continue to next encoding
          }
        }
      }
    } catch (e) {
      // If all else fails, use latin1 as fallback
      csvData = fileBuffer.toString('latin1');
      encoding = 'latin1';
    }

    return {
      cleanedData: csvData,
      hasBOM,
      encoding,
    };
  }

  /**
   * Utility method to normalize column names (remove BOM, trim, etc.)
   * @param columns - Array of column names
   * @returns Normalized column names
   */
  normalizeColumnNames(columns: string[]): string[] {
    return columns.map(col => {
      // Remove BOM characters
      let normalized = col.replace(/^\ufeff/, '').replace(/\uFEFF/g, '');
      
      // Trim whitespace
      normalized = normalized.trim();
      
      // Handle quoted column names
      if (normalized.startsWith('"') && normalized.endsWith('"')) {
        normalized = normalized.slice(1, -1);
      }
      
      return normalized;
    });
  }

  /**
   * Find column by name with fuzzy matching (case-insensitive, whitespace-tolerant)
   * @param availableColumns - Available column names
   * @param targetColumn - Target column name to find
   * @returns Found column name or null
   */
  findColumn(availableColumns: string[], targetColumn: string): string | null {
    const normalizedTarget = targetColumn.toLowerCase().trim().replace(/\s+/g, ' ');
    
    // Exact match first
    for (const col of availableColumns) {
      if (col.toLowerCase().trim().replace(/\s+/g, ' ') === normalizedTarget) {
        return col;
      }
    }
    
    // Partial match
    for (const col of availableColumns) {
      const normalizedCol = col.toLowerCase().trim().replace(/\s+/g, ' ');
      if (normalizedCol.includes(normalizedTarget) || normalizedTarget.includes(normalizedCol)) {
        return col;
      }
    }
    
    return null;
  }

  /**
   * Extract numeric value from string (handles various formats)
   * @param value - String value to parse
   * @returns Parsed number or 0 if invalid
   */
  parseNumber(value: any): number {
    if (typeof value === 'number') {
      return value;
    }
    
    if (!value || value === '') {
      return 0;
    }
    
    // Handle string values
    const stringValue = String(value).trim();
    
    // Remove common non-numeric characters
    const cleanValue = stringValue.replace(/[,$%]/g, '');
    
    const num = parseFloat(cleanValue);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Clean string value (trim, handle null/undefined)
   * @param value - Value to clean
   * @returns Cleaned string
   */
  cleanString(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    let cleanValue = String(value).trim();
    
    // Remove surrounding quotes if present
    if (cleanValue.startsWith('"') && cleanValue.endsWith('"')) {
      cleanValue = cleanValue.slice(1, -1);
    }
    
    return cleanValue;
  }
}