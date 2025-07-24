import { Injectable } from '@nestjs/common';
import { CsvParserService } from '../../../common/services/csv-parser.service';
import { InquirEDProductInfo } from './inquired.types';
import * as fs from 'fs';
import * as path from 'path';

interface SkuLookupRow {
  'Product Category': string;
  Description: string;
  SKU: string;
}

@Injectable()
export class InquirEDService {
  private skuLookupTable: Map<string, InquirEDProductInfo> = new Map();
  private isLoaded = false;

  constructor(private csvParser: CsvParserService) {}

  async loadSkuLookupTable(): Promise<void> {
    if (this.isLoaded) {
      return;
    }

    try {
      const lookupFilePath = path.join(
        __dirname,
        '../../../../docs/sample-data/Customers/InquirED/Packing Slip Look Up Table.csv',
      );

      // Check if file exists
      if (!fs.existsSync(lookupFilePath)) {
        console.warn('SKU lookup file not found, using default lookup data');
        this.loadDefaultSkuData();
        return;
      }

      // Read and parse the CSV file
      const fileBuffer = fs.readFileSync(lookupFilePath);
      const parseResult =
        await this.csvParser.parseCSV<SkuLookupRow>(fileBuffer);

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
      console.log(
        `Loaded ${this.skuLookupTable.size} SKU entries from lookup table`,
      );
    } catch (error) {
      console.error('Error loading SKU lookup table:', error);
      this.loadDefaultSkuData();
    }
  }

  getSkuInfo(sku: string): InquirEDProductInfo | undefined {
    return this.skuLookupTable.get(sku);
  }

  getAllSkus(): string[] {
    return Array.from(this.skuLookupTable.keys());
  }

  getSkusByCategory(
    category: InquirEDProductInfo['category'],
  ): InquirEDProductInfo[] {
    return Array.from(this.skuLookupTable.values()).filter(
      (info) => info.category === category,
    );
  }

  private mapCategoryToType(category: string): InquirEDProductInfo['category'] {
    const normalizedCategory = category.toLowerCase().trim();

    if (normalizedCategory.includes('english')) {
      return 'Printed Materials (EN)';
    } else if (normalizedCategory.includes('spanish')) {
      return 'Printed Materials (SP)';
    } else if (normalizedCategory.includes('teacher')) {
      return 'Teacher Edition';
    }

    // Default fallback based on SKU pattern
    return 'Printed Materials (EN)';
  }

  private loadDefaultSkuData(): void {
    // Fallback data based on the sample CSV provided
    const defaultSkuData: InquirEDProductInfo[] = [
      // Printed Materials (EN)
      {
        sku: 'IND-IJ-PM-NAVIG-EN-0100',
        description: 'Navigating School (English)',
        category: 'Printed Materials (EN)',
      },
      {
        sku: 'IND-IJ-PM-MYTEAM-EN-0200',
        description: 'My Team and Self (English)',
        category: 'Printed Materials (EN)',
      },
      {
        sku: 'IND-IJ-PM-PASTF-EN-0300',
        description: 'Past, Present, and Future (English)',
        category: 'Printed Materials (EN)',
      },
      {
        sku: 'IND-IJ-PM-FAMLF-EN-0400',
        description: 'Families Near and Far (English)',
        category: 'Printed Materials (EN)',
      },
      {
        sku: 'IND-IJ-PM-LOCAT-EN-0500',
        description: 'Our Special Location (English)',
        category: 'Printed Materials (EN)',
      },
      {
        sku: 'IND-IJ-PM-CIVIC-EN-0600',
        description: 'Civic Engagement (English)',
        category: 'Printed Materials (EN)',
      },
      {
        sku: 'IND-IJ-PM-NEEDS-EN-0700',
        description: 'Meeting Needs and Wants (English)',
        category: 'Printed Materials (EN)',
      },
      {
        sku: 'IND-IJ-PM-LAND-EN-0800',
        description: 'Our Changing Landscape (English)',
        category: 'Printed Materials (EN)',
      },
      {
        sku: 'IND-IJ-PM-INNOV-EN-0900',
        description: 'Innovation (English)',
        category: 'Printed Materials (EN)',
      },
      {
        sku: 'IND-IJ-PM-GLOBAL-EN-1000',
        description: 'Global Connections (English)',
        category: 'Printed Materials (EN)',
      },
      {
        sku: 'IND-IJ-PM-MIGRA-EN-1100',
        description: 'Migration and Movement (English)',
        category: 'Printed Materials (EN)',
      },
      {
        sku: 'IND-IJ-PM-CIVRT-EN-1200',
        description: 'The 20th Century Civil Rights Movement (English)',
        category: 'Printed Materials (EN)',
      },
      {
        sku: 'IND-IJ-PM-NATRES-EN-1300',
        description: 'Natural Resources of the US (English)',
        category: 'Printed Materials (EN)',
      },
      {
        sku: 'IND-IJ-PM-OURST-EN-1400',
        description: 'Our State and Region (English)',
        category: 'Printed Materials (EN)',
      },
      {
        sku: 'IND-IJ-PM-ECON-EN-1500',
        description: 'Economic Choices (English)',
        category: 'Printed Materials (EN)',
      },
      {
        sku: 'IND-IJ-PM-NATAM-EN-1600',
        description: 'Native America (English)',
        category: 'Printed Materials (EN)',
      },
      {
        sku: 'IND-IJ-PM-COLO-EN-1700',
        description: 'The Colonial Era (English)',
        category: 'Printed Materials (EN)',
      },
      {
        sku: 'IND-IJ-PM-AMREV-EN-1800',
        description: 'The American Revolution (English)',
        category: 'Printed Materials (EN)',
      },
      {
        sku: 'IND-IJ-PM-RIGHTS-EN-1900',
        description: 'Rights and Responsibilities (English)',
        category: 'Printed Materials (EN)',
      },

      // Printed Materials (SP)
      {
        sku: 'IND-IJ-PM-NAVIG-SP-0100',
        description: 'Desenvolverse en la Escuela',
        category: 'Printed Materials (SP)',
      },
      {
        sku: 'IND-IJ-PM-MYTEAM-SP-0200',
        description: 'Mi Equipo y Yo',
        category: 'Printed Materials (SP)',
      },
      {
        sku: 'IND-IJ-PM-PASTF-SP-0300',
        description: 'Pasado, Presente, y Futuro',
        category: 'Printed Materials (SP)',
      },
      {
        sku: 'IND-IJ-PM-FAMLF-SP-0400',
        description: 'Familias de Todas Partes',
        category: 'Printed Materials (SP)',
      },
      {
        sku: 'IND-IJ-PM-LOCAT-SP-0500',
        description: 'Nuestra Ubicacion Especial',
        category: 'Printed Materials (SP)',
      },
      {
        sku: 'IND-IJ-PM-CIVIC-SP-0600',
        description: 'Compromiso Civico',
        category: 'Printed Materials (SP)',
      },
      {
        sku: 'IND-IJ-PM-NEEDS-SP-0700',
        description: 'Satisfacer ecesidades y deseos',
        category: 'Printed Materials (SP)',
      },
      {
        sku: 'IND-IJ-PM-LAND-SP-0800',
        description: 'Nuestro paisaje cambiante',
        category: 'Printed Materials (SP)',
      },
      {
        sku: 'IND-IJ-PM-INNOV-SP-0900',
        description: 'Innovacion',
        category: 'Printed Materials (SP)',
      },
      {
        sku: 'IND-IJ-PM-GLOBAL-SP-1000',
        description: 'Conexiones globales',
        category: 'Printed Materials (SP)',
      },
      {
        sku: 'IND-IJ-PM-MIGRA-SP-1100',
        description: 'Migracion y movimiento',
        category: 'Printed Materials (SP)',
      },
      {
        sku: 'IND-IJ-PM-CIVRT-SP-1200',
        description: 'Movimiento por los derechos civiles del siglo XX',
        category: 'Printed Materials (SP)',
      },
      {
        sku: 'IND-IJ-PM-NATRES-SP-1300',
        description: 'Recursos naturales de los EE. UU.',
        category: 'Printed Materials (SP)',
      },
      {
        sku: 'IND-IJ-PM-OURST-SP-1400',
        description: 'Nuestro Estao y Region',
        category: 'Printed Materials (SP)',
      },
      {
        sku: 'IND-IJ-PM-ECON-SP-1500',
        description: 'Decisiones economicas',
        category: 'Printed Materials (SP)',
      },
      {
        sku: 'IND-IJ-PM-NATAM-SP-1600',
        description: 'America Nativa',
        category: 'Printed Materials (SP)',
      },
      {
        sku: 'IND-IJ-PM-COLO-SP-1700',
        description: 'La epoca colonial',
        category: 'Printed Materials (SP)',
      },
      {
        sku: 'IND-IJ-PM-AMREV-SP-1800',
        description: 'La revolucion estadounidense',
        category: 'Printed Materials (SP)',
      },
      {
        sku: 'IND-IJ-PM-RIGHTS-SP-1900',
        description: 'Derechos y responsabilidades',
        category: 'Printed Materials (SP)',
      },

      // Teacher Editions
      {
        sku: 'IND-IJ-TE-NAVIG-0100',
        description: 'Navigating School',
        category: 'Teacher Edition',
      },
      {
        sku: 'IND-IJ-TE-MYTEAM-0200',
        description: 'My Team and Self',
        category: 'Teacher Edition',
      },
      {
        sku: 'IND-IJ-TE-PASTF-0300',
        description: 'Past, Present, and Future',
        category: 'Teacher Edition',
      },
      {
        sku: 'IND-IJ-TE-FAMLF-0400',
        description: 'Families Near and Far',
        category: 'Teacher Edition',
      },
      {
        sku: 'IND-IJ-TE-LOCAT-0500',
        description: 'Our Special Location',
        category: 'Teacher Edition',
      },
      {
        sku: 'IND-IJ-TE-CIVIC-0600',
        description: 'Civic Engagement',
        category: 'Teacher Edition',
      },
      {
        sku: 'IND-IJ-TE-NEEDS-0700',
        description: 'Meeting Needs and Wants',
        category: 'Teacher Edition',
      },
      {
        sku: 'IND-IJ-TE-LAND-0800',
        description: 'Our Changing Landscape',
        category: 'Teacher Edition',
      },
      {
        sku: 'IND-IJ-TE-INNOV-0900',
        description: 'Innovation',
        category: 'Teacher Edition',
      },
      {
        sku: 'IND-IJ-TE-GLOBAL-1000',
        description: 'Global Connections',
        category: 'Teacher Edition',
      },
      {
        sku: 'IND-IJ-TE-MIGRA-1100',
        description: 'Migration and Movement',
        category: 'Teacher Edition',
      },
      {
        sku: 'IND-IJ-TE-CIVRT-1200',
        description: 'The 20th Century Civil Rights Movement',
        category: 'Teacher Edition',
      },
      {
        sku: 'IND-IJ-TE-NATRES-1300',
        description: 'Natural Resources of the US',
        category: 'Teacher Edition',
      },
      {
        sku: 'IND-IJ-TE-OURST-1400',
        description: 'Our State and Region',
        category: 'Teacher Edition',
      },
      {
        sku: 'IND-IJ-TE-ECON-1500',
        description: 'Economic Choices',
        category: 'Teacher Edition',
      },
      {
        sku: 'IND-IJ-TE-NATAM-1600',
        description: 'Native America',
        category: 'Teacher Edition',
      },
      {
        sku: 'IND-IJ-TE-COLO-1700',
        description: 'The Colonial Era',
        category: 'Teacher Edition',
      },
      {
        sku: 'IND-IJ-TE-AMREV-1800',
        description: 'The American Revolution',
        category: 'Teacher Edition',
      },
      {
        sku: 'IND-IJ-TE-RIGHTS-1900',
        description: 'Rights and Responsibilities',
        category: 'Teacher Edition',
      },
    ];

    this.skuLookupTable.clear();
    defaultSkuData.forEach((item) => {
      this.skuLookupTable.set(item.sku, item);
    });

    this.isLoaded = true;
    console.log(`Loaded ${this.skuLookupTable.size} default SKU entries`);
  }
}
