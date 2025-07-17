import { Injectable } from '@nestjs/common';
import { CsvParserService } from '../../../common/services/csv-parser.service';
import { InquireEdProductInfo } from './inquire-ed.types';
import * as fs from 'fs';
import * as path from 'path';

interface SkuLookupRow {
  'Product Category': string;
  'Description': string;
  'SKU': string;
}

@Injectable()
export class InquireEdService {
  private skuLookupTable: Map<string, InquireEdProductInfo> = new Map();
  private isLoaded = false;

  constructor(private csvParser: CsvParserService) {}

  async loadSkuLookupTable(): Promise<void> {
    if (this.isLoaded) {
      return;
    }

    try {
      const lookupFilePath = path.join(
        __dirname,
        '../../../../docs/sample-data/Customers/InquireED/Packing Slip Look Up Table.csv'
      );

      // Check if file exists
      if (!fs.existsSync(lookupFilePath)) {
        console.warn('SKU lookup file not found, using default lookup data');
        this.loadDefaultSkuData();
        return;
      }

      // Read and parse the CSV file
      const fileBuffer = fs.readFileSync(lookupFilePath);
      const parseResult = await this.csvParser.parseCSV<SkuLookupRow>(fileBuffer);

      if (parseResult.errors.length > 0) {
        console.error('Errors parsing SKU lookup table:', parseResult.errors);
        this.loadDefaultSkuData();
        return;
      }

      // Process each row
      this.skuLookupTable.clear();
      for (const row of parseResult.data) {
        const sku = this.csvParser.cleanString(row.SKU);
        const description = this.csvParser.cleanString(row.Description);
        const category = this.csvParser.cleanString(row['Product Category']);

        if (sku && description && category) {
          this.skuLookupTable.set(sku, {
            sku,
            description,
            category: this.mapCategoryToType(category),
          });
        }
      }

      this.isLoaded = true;
      console.log(`Loaded ${this.skuLookupTable.size} SKU entries from lookup table`);
    } catch (error) {
      console.error('Error loading SKU lookup table:', error);
      this.loadDefaultSkuData();
    }
  }

  getSkuInfo(sku: string): InquireEdProductInfo | undefined {
    return this.skuLookupTable.get(sku);
  }

  getAllSkus(): string[] {
    return Array.from(this.skuLookupTable.keys());
  }

  getSkusByCategory(category: InquireEdProductInfo['category']): InquireEdProductInfo[] {
    return Array.from(this.skuLookupTable.values()).filter(
      info => info.category === category
    );
  }

  private mapCategoryToType(category: string): InquireEdProductInfo['category'] {
    const normalizedCategory = category.toLowerCase().trim();
    
    if (normalizedCategory.includes('english')) {
      return 'Printed Materials (English)';
    } else if (normalizedCategory.includes('spanish')) {
      return 'Printed Materials (Spanish)';
    } else if (normalizedCategory.includes('teacher')) {
      return 'Printed Teacher Editions';
    }
    
    // Default fallback based on SKU pattern
    return 'Printed Materials (English)';
  }

  private loadDefaultSkuData(): void {
    // Fallback data based on the sample CSV provided
    const defaultSkuData: InquireEdProductInfo[] = [
      // Printed Materials (English)
      { sku: 'IND-IJ-PM-NAVIG-EN-0100', description: 'Navigating School (English)', category: 'Printed Materials (English)' },
      { sku: 'IND-IJ-PM-MYTEAM-EN-0200', description: 'My Team and Self (English)', category: 'Printed Materials (English)' },
      { sku: 'IND-IJ-PM-PASTF-EN-0300', description: 'Past, Present, and Future (English)', category: 'Printed Materials (English)' },
      { sku: 'IND-IJ-PM-FAMLF-EN-0400', description: 'Families Near and Far (English)', category: 'Printed Materials (English)' },
      { sku: 'IND-IJ-PM-LOCAT-EN-0500', description: 'Our Special Location (English)', category: 'Printed Materials (English)' },
      { sku: 'IND-IJ-PM-CIVIC-EN-0600', description: 'Civic Engagement (English)', category: 'Printed Materials (English)' },
      { sku: 'IND-IJ-PM-NEEDS-EN-0700', description: 'Meeting Needs and Wants (English)', category: 'Printed Materials (English)' },
      { sku: 'IND-IJ-PM-LAND-EN-0800', description: 'Our Changing Landscape (English)', category: 'Printed Materials (English)' },
      { sku: 'IND-IJ-PM-INNOV-EN-0900', description: 'Innovation (English)', category: 'Printed Materials (English)' },
      { sku: 'IND-IJ-PM-GLOBAL-EN-1000', description: 'Global Connections (English)', category: 'Printed Materials (English)' },
      { sku: 'IND-IJ-PM-MIGRA-EN-1100', description: 'Migration and Movement (English)', category: 'Printed Materials (English)' },
      { sku: 'IND-IJ-PM-CIVRT-EN-1200', description: 'The 20th Century Civil Rights Movement (English)', category: 'Printed Materials (English)' },
      { sku: 'IND-IJ-PM-NATRES-EN-1300', description: 'Natural Resources of the US (English)', category: 'Printed Materials (English)' },
      { sku: 'IND-IJ-PM-OURST-EN-1400', description: 'Our State and Region (English)', category: 'Printed Materials (English)' },
      { sku: 'IND-IJ-PM-ECON-EN-1500', description: 'Economic Choices (English)', category: 'Printed Materials (English)' },
      { sku: 'IND-IJ-PM-NATAM-EN-1600', description: 'Native America (English)', category: 'Printed Materials (English)' },
      { sku: 'IND-IJ-PM-COLO-EN-1700', description: 'The Colonial Era (English)', category: 'Printed Materials (English)' },
      { sku: 'IND-IJ-PM-AMREV-EN-1800', description: 'The American Revolution (English)', category: 'Printed Materials (English)' },
      { sku: 'IND-IJ-PM-RIGHTS-EN-1900', description: 'Rights and Responsibilities (English)', category: 'Printed Materials (English)' },
      
      // Printed Materials (Spanish)
      { sku: 'IND-IJ-PM-NAVIG-SP-0100', description: 'Navigating School (Spanish)', category: 'Printed Materials (Spanish)' },
      { sku: 'IND-IJ-PM-MYTEAM-SP-0200', description: 'My Team and Self (Spanish)', category: 'Printed Materials (Spanish)' },
      { sku: 'IND-IJ-PM-PASTF-SP-0300', description: 'Past, Present, and Future (Spanish)', category: 'Printed Materials (Spanish)' },
      { sku: 'IND-IJ-PM-FAMLF-SP-0400', description: 'Families Near and Far (Spanish)', category: 'Printed Materials (Spanish)' },
      { sku: 'IND-IJ-PM-LOCAT-SP-0500', description: 'Our Special Location (Spanish)', category: 'Printed Materials (Spanish)' },
      { sku: 'IND-IJ-PM-CIVIC-SP-0600', description: 'Civic Engagement (Spanish)', category: 'Printed Materials (Spanish)' },
      { sku: 'IND-IJ-PM-NEEDS-SP-0700', description: 'Meeting Needs and Wants (Spanish)', category: 'Printed Materials (Spanish)' },
      { sku: 'IND-IJ-PM-LAND-SP-0800', description: 'Our Changing Landscape (Spanish)', category: 'Printed Materials (Spanish)' },
      { sku: 'IND-IJ-PM-INNOV-SP-0900', description: 'Innovation (Spanish)', category: 'Printed Materials (Spanish)' },
      { sku: 'IND-IJ-PM-GLOBAL-SP-1000', description: 'Global Connections (Spanish)', category: 'Printed Materials (Spanish)' },
      { sku: 'IND-IJ-PM-MIGRA-SP-1100', description: 'Migration and Movement (Spanish)', category: 'Printed Materials (Spanish)' },
      { sku: 'IND-IJ-PM-CIVRT-SP-1200', description: 'The 20th Century Civil Rights Movement (Spanish)', category: 'Printed Materials (Spanish)' },
      { sku: 'IND-IJ-PM-NATRES-SP-1300', description: 'Natural Resources of the US (Spanish)', category: 'Printed Materials (Spanish)' },
      { sku: 'IND-IJ-PM-OURST-SP-1400', description: 'Our State and Region (Spanish)', category: 'Printed Materials (Spanish)' },
      { sku: 'IND-IJ-PM-ECON-SP-1500', description: 'Economic Choices (Spanish)', category: 'Printed Materials (Spanish)' },
      { sku: 'IND-IJ-PM-NATAM-SP-1600', description: 'Native America (Spanish)', category: 'Printed Materials (Spanish)' },
      { sku: 'IND-IJ-PM-COLO-SP-1700', description: 'The Colonial Era (Spanish)', category: 'Printed Materials (Spanish)' },
      { sku: 'IND-IJ-PM-AMREV-SP-1800', description: 'The American Revolution (Spanish)', category: 'Printed Materials (Spanish)' },
      { sku: 'IND-IJ-PM-RIGHTS-SP-1900', description: 'Rights and Responsibilities (Spanish)', category: 'Printed Materials (Spanish)' },
      
      // Teacher Editions
      { sku: 'IND-IJ-TE-NAVIG-0100', description: 'Navigating School', category: 'Printed Teacher Editions' },
      { sku: 'IND-IJ-TE-MYTEAM-0200', description: 'My Team and Self', category: 'Printed Teacher Editions' },
      { sku: 'IND-IJ-TE-PASTF-0300', description: 'Past, Present, and Future', category: 'Printed Teacher Editions' },
      { sku: 'IND-IJ-TE-FAMLF-0400', description: 'Families Near and Far', category: 'Printed Teacher Editions' },
      { sku: 'IND-IJ-TE-LOCAT-0500', description: 'Our Special Location', category: 'Printed Teacher Editions' },
      { sku: 'IND-IJ-TE-CIVIC-0600', description: 'Civic Engagement', category: 'Printed Teacher Editions' },
      { sku: 'IND-IJ-TE-NEEDS-0700', description: 'Meeting Needs and Wants', category: 'Printed Teacher Editions' },
      { sku: 'IND-IJ-TE-LAND-0800', description: 'Our Changing Landscape', category: 'Printed Teacher Editions' },
      { sku: 'IND-IJ-TE-INNOV-0900', description: 'Innovation', category: 'Printed Teacher Editions' },
      { sku: 'IND-IJ-TE-GLOBAL-1000', description: 'Global Connections', category: 'Printed Teacher Editions' },
      { sku: 'IND-IJ-TE-MIGRA-1100', description: 'Migration and Movement', category: 'Printed Teacher Editions' },
      { sku: 'IND-IJ-TE-CIVRT-1200', description: 'The 20th Century Civil Rights Movement', category: 'Printed Teacher Editions' },
      { sku: 'IND-IJ-TE-NATRES-1300', description: 'Natural Resources of the US', category: 'Printed Teacher Editions' },
      { sku: 'IND-IJ-TE-OURST-1400', description: 'Our State and Region', category: 'Printed Teacher Editions' },
      { sku: 'IND-IJ-TE-ECON-1500', description: 'Economic Choices', category: 'Printed Teacher Editions' },
      { sku: 'IND-IJ-TE-NATAM-1600', description: 'Native America', category: 'Printed Teacher Editions' },
      { sku: 'IND-IJ-TE-COLO-1700', description: 'The Colonial Era', category: 'Printed Teacher Editions' },
      { sku: 'IND-IJ-TE-AMREV-1800', description: 'The American Revolution', category: 'Printed Teacher Editions' },
      { sku: 'IND-IJ-TE-RIGHTS-1900', description: 'Rights and Responsibilities', category: 'Printed Teacher Editions' },
    ];

    this.skuLookupTable.clear();
    defaultSkuData.forEach(item => {
      this.skuLookupTable.set(item.sku, item);
    });

    this.isLoaded = true;
    console.log(`Loaded ${this.skuLookupTable.size} default SKU entries`);
  }
}