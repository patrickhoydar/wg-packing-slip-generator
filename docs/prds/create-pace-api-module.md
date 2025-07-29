# PACE API Integration Porting Guide

## Overview

This guide provides comprehensive documentation for porting the PACE API shipment creation functionality from the WG Order Processor to another NestJS application. The focus is on creating shipments in PACE based on CSV order data using the `createJobShipment` and `createJobShipments` interfaces.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Interfaces](#core-interfaces)
3. [PACE API Configuration](#pace-api-configuration)
4. [Implementation Guide](#implementation-guide)
5. [Data Mapping Services](#data-mapping-services)
6. [CSV-to-PACE Flow](#csv-to-pace-flow)
7. [Testing & Validation](#testing--validation)
8. [Production Considerations](#production-considerations)

## Architecture Overview

The PACE API integration follows Clean Architecture principles with a ports-and-adapters pattern:

```
┌─────────────────────────────────────────────────────┐
│                  Application Layer                  │
│  ┌─────────────────┐    ┌─────────────────────────┐ │
│  │   CSV Parser    │    │   Business Logic       │ │
│  │   Service       │    │   (Your Domain)        │ │
│  └─────────────────┘    └─────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────┐
│                  Domain Layer                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │              PaceOrderPort                      │ │
│  │         (Interface/Contract)                    │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────┐
│               Infrastructure Layer                  │
│  ┌─────────────────────────────────────────────────┐ │
│  │            PaceOrderAdapter                     │ │
│  │         (PACE API Implementation)               │ │
│  └─────────────────────────────────────────────────┘ │
│  ┌─────────────────┐    ┌─────────────────────────┐ │
│  │ CarrierMapping  │    │ PaceShipmentMapping     │ │
│  │    Service      │    │       Service           │ │
│  └─────────────────┘    └─────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Core Interfaces

### PaceOrderPort Interface

The main contract for PACE API operations. For shipment creation, focus on these methods:

```typescript
export interface PaceOrderPort {
  /**
   * Creates a single shipment in PACE
   */
  createJobShipment(params: {
    job: string                    // PACE job ID (e.g., "GOVD-12345")
    shipmentType: number          // Shipment type (50 = standard outbound)
    shipVia: number              // Carrier service ID (see carrier mappings)
    quantity: number             // Number of items (typically 1)
    contactLastName: string      // Recipient last name
    contactFirstName: string     // Recipient first name
    address1: string            // Street address line 1
    address2?: string           // Street address line 2 (optional)
    zip: string                 // Postal code
    city: string                // City name
    country: number             // Country ID (1 = US, 2 = CA)
    stateKey: string           // State in format "1:TX" (country:state)
    dateTime: string           // ISO datetime string
    cost: number               // Shipping cost
    charges: string            // Billing method ("Prepaid/Shipper" or "Third Party")
    weight: number             // Package weight
    shipped: boolean           // Shipment status (true for shipped)
    trackingNumber: string     // Carrier tracking number
    carton1Count: number       // Number of cartons (typically 1)
    count1: number            // Carton count alias (typically 1)
    carton1Quantity: number   // Items per carton (typically 1)
    u_internalShipNotes: string // Internal notes
    accountNumber?: string     // Third-party account number (optional)
    forcedAccountNumber?: boolean // Force account number usage (optional)
  }): Promise<void>

  /**
   * Creates shipments for all orders in a job (bulk operation)
   */
  createJobShipments(jobNumber: string): Promise<{
    success: boolean
    processedShipments: number
    skippedShipments: number
    errors: Array<{ shipmentId: string; error: string }>
  }>
}
```

### Key Data Types

```typescript
// Carrier mapping structure
interface CarrierMapping {
  carrierAlias: string    // Internal alias (e.g., "UPS_Ground")
  carrier: string        // Carrier name (e.g., "UPS")
  service: string       // Service name (e.g., "Ground")
  paceShipViaId: number // PACE shipVia ID (e.g., 1)
}

// Shipment processing result
interface ShipmentProcessingResult {
  success: boolean
  processedShipments: number
  skippedShipments: number
  errors: Array<{ shipmentId: string; error: string }>
}
```

## PACE API Configuration

### Environment Variables

```bash
# PACE API Configuration
PACE_BASE_URL=https://your-pace-instance.com/rpc/rest/services
PACE_USERNAME=your_pace_username
PACE_PASSWORD=your_pace_password

# Optional: Environment detection
NODE_ENV=production
```

### NestJS Configuration Module

```typescript
// config/pace.config.ts
export const paceConfig = () => ({
  pace: {
    baseUrl: process.env.PACE_BASE_URL,
    username: process.env.PACE_USERNAME,
    password: process.env.PACE_PASSWORD,
  },
});
```

## Implementation Guide

### Step 1: Create the Domain Port

```typescript
// src/pace/domain/ports/pace-order.port.ts
export interface PaceOrderPort {
  createJobShipment(params: CreateJobShipmentParams): Promise<void>
  createJobShipments(jobNumber: string): Promise<ShipmentProcessingResult>
}

interface CreateJobShipmentParams {
  job: string
  shipmentType: number
  shipVia: number
  quantity: number
  contactLastName: string
  contactFirstName: string
  address1: string
  address2?: string
  zip: string
  city: string
  country: number
  stateKey: string
  dateTime: string
  cost: number
  charges: string
  weight: number
  shipped: boolean
  trackingNumber: string
  carton1Count: number
  count1: number
  carton1Quantity: number
  u_internalShipNotes: string
  accountNumber?: string
  forcedAccountNumber?: boolean
}

interface ShipmentProcessingResult {
  success: boolean
  processedShipments: number
  skippedShipments: number
  errors: Array<{ shipmentId: string; error: string }>
}
```

### Step 2: Implement the PACE Adapter

```typescript
// src/pace/infrastructure/adapters/pace-order.adapter.ts
import { Injectable, Logger } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { ConfigService } from '@nestjs/config'
import { firstValueFrom } from 'rxjs'
import { PaceOrderPort } from '../../domain/ports/pace-order.port'

@Injectable()
export class PaceOrderAdapter implements PaceOrderPort {
  private readonly logger = new Logger(PaceOrderAdapter.name)
  private readonly apiBaseUrl: string
  private readonly auth: { username: string; password: string }
  
  // Token caching
  private authToken: string | null = null
  private tokenExpiry: Date | null = null
  private tokenRefreshInProgress = false

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {
    this.auth = {
      username: this.configService.get<string>('PACE_USERNAME'),
      password: this.configService.get<string>('PACE_PASSWORD')
    }
    this.apiBaseUrl = this.configService.get<string>('PACE_BASE_URL')
  }

  /**
   * Authentication token management with caching
   */
  private async getAuthToken(): Promise<string> {
    // Return cached token if still valid
    if (this.authToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.authToken
    }

    // Prevent concurrent token refreshes
    if (this.tokenRefreshInProgress) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      return this.getAuthToken()
    }

    try {
      this.tokenRefreshInProgress = true
      
      // PACE uses Basic Auth
      this.authToken = Buffer.from(`${this.auth.username}:${this.auth.password}`).toString('base64')
      this.tokenExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      
      return this.authToken
    } finally {
      this.tokenRefreshInProgress = false
    }
  }

  /**
   * Makes authenticated HTTP requests to PACE API
   */
  private async makeAuthenticatedRequest<T>(
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    data?: any
  ): Promise<T> {
    try {
      const token = await this.getAuthToken()
      
      const config = {
        headers: {
          Authorization: `Basic ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000, // 30 seconds
        maxRedirects: 5
      }

      let response
      switch (method) {
        case 'GET':
          response = await firstValueFrom(this.httpService.get(url, config))
          break
        case 'POST':
          response = await firstValueFrom(this.httpService.post(url, data, config))
          break
        case 'PUT':
          response = await firstValueFrom(this.httpService.put(url, data, config))
          break
        case 'DELETE':
          response = await firstValueFrom(this.httpService.delete(url, config))
          break
      }

      return response.data
    } catch (error) {
      // Handle 401 unauthorized - retry once with new token
      if (error.response?.status === 401) {
        this.authToken = null
        this.tokenExpiry = null
        return this.makeAuthenticatedRequest(url, method, data)
      }

      // Handle connection errors with retry
      if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        this.logger.warn(`Connection error (${error.code}) for ${url}. Retrying...`)
        await new Promise((resolve) => setTimeout(resolve, 1000))
        return this.makeAuthenticatedRequest(url, method, data)
      }

      this.logger.error(`PACE API request failed: ${url}`, error.message)
      throw error
    }
  }

  /**
   * Creates a single shipment in PACE
   */
  async createJobShipment(params: CreateJobShipmentParams): Promise<void> {
    try {
      const payload = {
        job: params.job,
        shipmentType: params.shipmentType,
        shipVia: params.shipVia,
        quantity: params.quantity,
        contactLastName: params.contactLastName,
        contactFirstName: params.contactFirstName,
        address1: params.address1,
        address2: params.address2 || '',
        zip: params.zip,
        city: params.city,
        country: params.country,
        stateKey: params.stateKey,
        dateTime: params.dateTime,
        cost: params.cost,
        charges: params.charges,
        weight: params.weight,
        shipped: params.shipped,
        trackingNumber: params.trackingNumber,
        carton1Count: params.carton1Count,
        count1: params.count1,
        carton1Quantity: params.carton1Quantity,
        u_internalShipNotes: params.u_internalShipNotes,
        ...(params.accountNumber && { accountNumber: params.accountNumber }),
        ...(params.forcedAccountNumber !== undefined && { 
          forcedAccountNumber: params.forcedAccountNumber 
        })
      }

      await this.makeAuthenticatedRequest(
        `${this.apiBaseUrl}/CreateObject/createJobShipment`,
        'POST',
        payload
      )

      this.logger.debug(`Created PACE shipment for job ${params.job}`)
    } catch (error) {
      this.logger.error(`Failed to create PACE shipment for job ${params.job}`, error)
      throw error
    }
  }

  /**
   * Creates shipments for all orders in a job (implement based on your data source)
   */
  async createJobShipments(jobNumber: string): Promise<ShipmentProcessingResult> {
    try {
      this.logger.debug(`Creating PACE shipments for job ${jobNumber}`)
      
      // TODO: Replace with your CSV data retrieval logic
      const shipmentData = await this.getShipmentDataForJob(jobNumber)
      
      let processedShipments = 0
      let skippedShipments = 0
      const errors: Array<{ shipmentId: string; error: string }> = []

      for (const shipment of shipmentData) {
        try {
          // Validate required fields
          if (!shipment.trackingNumber || !shipment.carrierInfo) {
            this.logger.warn(`Skipping shipment ${shipment.id} - missing required data`)
            skippedShipments++
            continue
          }

          // Transform your CSV data to PACE format
          const paceParams = this.transformToPaceFormat(shipment)
          
          await this.createJobShipment(paceParams)
          processedShipments++
          
        } catch (error) {
          this.logger.error(`Failed to create shipment ${shipment.id}`, error)
          errors.push({
            shipmentId: shipment.id,
            error: error.message
          })
        }
      }

      return {
        success: errors.length < shipmentData.length,
        processedShipments,
        skippedShipments,
        errors
      }
    } catch (error) {
      this.logger.error(`Failed to create PACE shipments for job ${jobNumber}`, error)
      throw error
    }
  }

  /**
   * TODO: Implement based on your CSV data source
   */
  private async getShipmentDataForJob(jobNumber: string): Promise<any[]> {
    // Replace with your CSV parsing/data retrieval logic
    throw new Error('Implement getShipmentDataForJob based on your CSV data source')
  }

  /**
   * TODO: Implement based on your CSV data structure
   */
  private transformToPaceFormat(shipment: any): CreateJobShipmentParams {
    // Replace with your CSV-to-PACE data transformation logic
    throw new Error('Implement transformToPaceFormat based on your CSV structure')
  }
}
```

### Step 3: Create Carrier Mapping Service

```typescript
// src/pace/infrastructure/services/carrier-mapping.service.ts
import { Injectable, Logger } from '@nestjs/common'

export interface CarrierMapping {
  carrierAlias: string
  carrier: string
  service: string
  paceShipViaId: number
}

@Injectable()
export class CarrierMappingService {
  private readonly logger = new Logger(CarrierMappingService.name)

  private readonly carrierMappings: CarrierMapping[] = [
    {
      carrierAlias: 'UPS_Ground',
      carrier: 'UPS',
      service: 'Ground',
      paceShipViaId: 1
    },
    {
      carrierAlias: 'FedEx_Ground', 
      carrier: 'FedEx',
      service: 'Ground',
      paceShipViaId: 5010
    },
    {
      carrierAlias: 'FedEx_International_Economy',
      carrier: 'FedEx', 
      service: 'International Economy',
      paceShipViaId: 5046
    },
    {
      carrierAlias: 'USPS_GroundAdvantage',
      carrier: 'USPS',
      service: 'Ground Advantage', 
      paceShipViaId: 5017
    },
    {
      carrierAlias: 'USPS_Express',
      carrier: 'USPS',
      service: 'Express',
      paceShipViaId: 5056
    },
    {
      carrierAlias: 'USPS_Priority',
      carrier: 'USPS',
      service: 'Priority',
      paceShipViaId: 5096
    },
    {
      carrierAlias: 'USPS_FirstClassFlat',
      carrier: 'USPS',
      service: 'firstclassmailflat',
      paceShipViaId: 5098
    }
  ]

  /**
   * Maps carrier alias to PACE shipVia ID
   */
  getPaceShipViaId(carrierAlias: string): number | null {
    const mapping = this.carrierMappings.find(m => m.carrierAlias === carrierAlias)
    
    if (!mapping) {
      this.logger.warn(`No PACE shipVia mapping found for carrier alias: ${carrierAlias}`)
      return null
    }

    return mapping.paceShipViaId
  }

  /**
   * Fallback mapping by carrier code and service name
   */
  getPaceShipViaIdByCarrierAndService(carrierCode: string, service: string): number | null {
    const normalizedCarrier = carrierCode.toUpperCase()
    const normalizedService = service.toLowerCase()

    const mapping = this.carrierMappings.find(m => {
      const mappingCarrier = m.carrier.toUpperCase()
      const mappingService = m.service.toLowerCase()
      
      return mappingCarrier === normalizedCarrier && 
             (mappingService.includes(normalizedService) || 
              normalizedService.includes(mappingService))
    })

    if (!mapping) {
      this.logger.warn(`No PACE shipVia mapping found for carrier: ${carrierCode}, service: ${service}`)
      return null
    }

    return mapping.paceShipViaId
  }

  /**
   * Get all available carrier mappings
   */
  getAllMappings(): CarrierMapping[] {
    return [...this.carrierMappings]
  }
}
```

### Step 4: Create Data Mapping Service

```typescript
// src/pace/infrastructure/services/pace-shipment-mapping.service.ts
import { Injectable, Logger } from '@nestjs/common'

@Injectable()
export class PaceShipmentMappingService {
  private readonly logger = new Logger(PaceShipmentMappingService.name)

  private readonly countryMappings: { [key: string]: number } = {
    'US': 1,
    'USA': 1,
    'United States': 1,
    'CA': 2,
    'Canada': 2,
    // Add more as needed
  }

  /**
   * Maps country string to PACE country ID
   */
  mapCountryToPaceId(country: string): number {
    const normalizedCountry = country?.trim()
    if (!normalizedCountry) {
      this.logger.warn('Empty country provided, defaulting to US (1)')
      return 1
    }

    const countryId = this.countryMappings[normalizedCountry] || 
                     this.countryMappings[normalizedCountry.toUpperCase()] ||
                     this.countryMappings[normalizedCountry.toLowerCase()]

    if (!countryId) {
      this.logger.warn(`Unknown country "${country}", defaulting to US (1)`)
      return 1
    }

    return countryId
  }

  /**
   * Formats state for PACE stateKey format (e.g., "1:TX")
   */
  formatStateKey(state: string, countryId: number = 1): string {
    const normalizedState = state?.trim()?.toUpperCase()
    if (!normalizedState) {
      this.logger.warn('Empty state provided, using empty stateKey')
      return `${countryId}:`
    }

    return `${countryId}:${normalizedState}`
  }

  /**
   * Parses full name into first and last name
   */
  parseContactName(fullName: string): { firstName: string; lastName: string } {
    const normalizedName = fullName?.trim()
    if (!normalizedName) {
      return { firstName: 'Unknown', lastName: 'Customer' }
    }

    const nameParts = normalizedName.split(' ')
    if (nameParts.length === 1) {
      return { firstName: nameParts[0], lastName: 'Customer' }
    }

    const firstName = nameParts[0]
    const lastName = nameParts.slice(1).join(' ')
    
    return { firstName, lastName: lastName || 'Customer' }
  }

  /**
   * Formats datetime for PACE API
   */
  formatDateTime(date: Date): string {
    return date.toISOString()
  }

  /**
   * Determines if shipping is third party
   */
  isThirdPartyShipping(shippingCharges: string | null): boolean {
    if (!shippingCharges) return false
    
    const normalized = shippingCharges.toUpperCase()
    return normalized === 'THIRD_PARTY' || normalized === 'THIRDPARTY'
  }

  /**
   * Gets charges string for PACE
   */
  getChargesString(isThirdParty: boolean): string {
    return isThirdParty ? 'Third Party/Ship Bill To' : 'Prepaid/Shipper'
  }
}
```

### Step 5: Module Configuration

```typescript
// src/pace/pace.module.ts
import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { ConfigModule } from '@nestjs/config'
import { PaceOrderAdapter } from './infrastructure/adapters/pace-order.adapter'
import { CarrierMappingService } from './infrastructure/services/carrier-mapping.service'
import { PaceShipmentMappingService } from './infrastructure/services/pace-shipment-mapping.service'

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    ConfigModule,
  ],
  providers: [
    {
      provide: 'PaceOrderPort',
      useClass: PaceOrderAdapter,
    },
    PaceOrderAdapter,
    CarrierMappingService,
    PaceShipmentMappingService,
  ],
  exports: [
    'PaceOrderPort',
    PaceOrderAdapter,
    CarrierMappingService,
    PaceShipmentMappingService,
  ],
})
export class PaceModule {}
```

## Data Mapping Services

### CSV Data Transformation

Here's a template for transforming CSV data to PACE format:

```typescript
// Example CSV row structure (adapt to your CSV format)
interface CsvShipmentRow {
  jobNumber: string
  customerName: string
  address1: string
  address2?: string
  city: string
  state: string
  zipCode: string
  country: string
  trackingNumber: string
  carrier: string
  service: string
  weight: number
  cost: number
  shippingDate: string
  // ... other CSV fields
}

/**
 * Transform CSV row to PACE shipment parameters
 */
private transformCsvToPaceFormat(csvRow: CsvShipmentRow): CreateJobShipmentParams {
  // Parse contact name
  const { firstName, lastName } = this.paceShipmentMappingService.parseContactName(csvRow.customerName)
  
  // Map country and state
  const countryId = this.paceShipmentMappingService.mapCountryToPaceId(csvRow.country)
  const stateKey = this.paceShipmentMappingService.formatStateKey(csvRow.state, countryId)
  
  // Map carrier to PACE shipVia ID
  const carrierAlias = `${csvRow.carrier}_${csvRow.service}` // e.g., "UPS_Ground"
  const shipViaId = this.carrierMappingService.getPaceShipViaId(carrierAlias) ||
                   this.carrierMappingService.getPaceShipViaIdByCarrierAndService(csvRow.carrier, csvRow.service)
  
  if (!shipViaId) {
    throw new Error(`Unknown carrier/service combination: ${csvRow.carrier}/${csvRow.service}`)
  }

  return {
    job: `GOVD-${csvRow.jobNumber}`,        // Format job number for PACE
    shipmentType: 50,                        // Standard outbound shipment
    shipVia: shipViaId,                     // Mapped carrier ID
    quantity: 1,                            // Typically 1 for document orders
    contactLastName: lastName,
    contactFirstName: firstName,
    address1: csvRow.address1,
    address2: csvRow.address2,
    zip: csvRow.zipCode,
    city: csvRow.city,
    country: countryId,
    stateKey: stateKey,
    dateTime: this.paceShipmentMappingService.formatDateTime(new Date(csvRow.shippingDate)),
    cost: csvRow.cost,
    charges: 'Prepaid/Shipper',             // Default for most shipments
    weight: csvRow.weight || 1,             // Default weight if not provided
    shipped: true,                          // Mark as shipped
    trackingNumber: csvRow.trackingNumber,
    carton1Count: 1,                        // Single carton
    count1: 1,                              // Carton count alias
    carton1Quantity: 1,                     // Items per carton
    u_internalShipNotes: 'Shipment from CSV import',
    // Third-party shipping fields (if applicable)
    // accountNumber: csvRow.thirdPartyAccount,
    // forcedAccountNumber: !!csvRow.thirdPartyAccount,
  }
}
```

## CSV-to-PACE Flow

### Application Service Example

```typescript
// src/shipments/application/services/csv-shipment-processor.service.ts
import { Injectable, Logger } from '@nestjs/common'
import { Inject } from '@nestjs/common'
import { PaceOrderPort } from '../../pace/domain/ports/pace-order.port'

@Injectable()
export class CsvShipmentProcessorService {
  private readonly logger = new Logger(CsvShipmentProcessorService.name)

  constructor(
    @Inject('PaceOrderPort')
    private readonly paceOrderPort: PaceOrderPort,
    // Inject your CSV parser service here
  ) {}

  /**
   * Process CSV file and create PACE shipments
   */
  async processCsvFile(filePath: string): Promise<{
    totalRows: number
    processed: number
    errors: Array<{ row: number; error: string }>
  }> {
    try {
      // Parse CSV file (implement based on your CSV library)
      const csvRows = await this.parseCsvFile(filePath)
      
      let processed = 0
      const errors: Array<{ row: number; error: string }> = []

      for (let i = 0; i < csvRows.length; i++) {
        try {
          const csvRow = csvRows[i]
          
          // Validate required fields
          if (!this.validateCsvRow(csvRow)) {
            errors.push({ row: i + 1, error: 'Missing required fields' })
            continue
          }

          // Transform and create PACE shipment
          const paceParams = this.transformCsvToPaceFormat(csvRow)
          await this.paceOrderPort.createJobShipment(paceParams)
          
          processed++
          this.logger.debug(`Processed row ${i + 1}: ${csvRow.trackingNumber}`)
          
        } catch (error) {
          this.logger.error(`Error processing row ${i + 1}`, error)
          errors.push({ row: i + 1, error: error.message })
        }
      }

      return {
        totalRows: csvRows.length,
        processed,
        errors
      }
    } catch (error) {
      this.logger.error('Failed to process CSV file', error)
      throw error
    }
  }

  /**
   * Process shipments for a specific job (bulk operation)
   */
  async processJobShipments(jobNumber: string): Promise<any> {
    return this.paceOrderPort.createJobShipments(jobNumber)
  }

  private async parseCsvFile(filePath: string): Promise<any[]> {
    // TODO: Implement CSV parsing logic
    // Use libraries like csv-parser, papaparse, or similar
    throw new Error('Implement CSV parsing logic')
  }

  private validateCsvRow(row: any): boolean {
    // TODO: Implement validation logic for required CSV fields
    return !!(row.jobNumber && row.trackingNumber && row.customerName)
  }

  private transformCsvToPaceFormat(csvRow: any): any {
    // TODO: Implement transformation logic (see example above)
    throw new Error('Implement CSV to PACE transformation')
  }
}
```

### Controller Example

```typescript
// src/shipments/infrastructure/controllers/shipment.controller.ts
import { Controller, Post, UploadedFile, UseInterceptors, Param } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { CsvShipmentProcessorService } from '../../application/services/csv-shipment-processor.service'

@Controller('shipments')
export class ShipmentController {
  constructor(
    private readonly csvShipmentProcessor: CsvShipmentProcessorService
  ) {}

  @Post('upload-csv')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCsvFile(@UploadedFile() file: Express.Multer.File) {
    // Save file temporarily
    const filePath = await this.saveUploadedFile(file)
    
    // Process CSV and create PACE shipments
    const result = await this.csvShipmentProcessor.processCsvFile(filePath)
    
    // Cleanup temporary file
    await this.cleanupFile(filePath)
    
    return {
      message: `Processed ${result.processed} of ${result.totalRows} shipments`,
      details: result
    }
  }

  @Post('job/:jobNumber/create-pace-shipments')
  async createJobShipments(@Param('jobNumber') jobNumber: string) {
    const result = await this.csvShipmentProcessor.processJobShipments(jobNumber)
    
    return {
      message: `Processed ${result.processedShipments} shipments for job ${jobNumber}`,
      details: result
    }
  }

  private async saveUploadedFile(file: Express.Multer.File): Promise<string> {
    // TODO: Implement file saving logic
    throw new Error('Implement file saving')
  }

  private async cleanupFile(filePath: string): Promise<void> {
    // TODO: Implement file cleanup
  }
}
```

## Testing & Validation

### Unit Tests

```typescript
// src/pace/infrastructure/adapters/pace-order.adapter.spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { HttpService } from '@nestjs/axios'
import { ConfigService } from '@nestjs/config'
import { PaceOrderAdapter } from './pace-order.adapter'
import { of } from 'rxjs'

describe('PaceOrderAdapter', () => {
  let adapter: PaceOrderAdapter
  let httpService: HttpService
  let configService: ConfigService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaceOrderAdapter,
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
            get: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              const config = {
                PACE_BASE_URL: 'https://test-pace.com/rpc/rest/services',
                PACE_USERNAME: 'test_user',
                PACE_PASSWORD: 'test_pass',
              }
              return config[key]
            }),
          },
        },
      ],
    }).compile()

    adapter = module.get<PaceOrderAdapter>(PaceOrderAdapter)
    httpService = module.get<HttpService>(HttpService)
    configService = module.get<ConfigService>(ConfigService)
  })

  describe('createJobShipment', () => {
    it('should create a shipment successfully', async () => {
      const mockResponse = { data: { success: true } }
      jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse))

      const params = {
        job: 'GOVD-12345',
        shipmentType: 50,
        shipVia: 1,
        quantity: 1,
        contactLastName: 'Doe',
        contactFirstName: 'John',
        address1: '123 Main St',
        zip: '12345',
        city: 'Anytown',
        country: 1,
        stateKey: '1:CA',
        dateTime: '2025-01-27T14:30:00.000Z',
        cost: 10.50,
        charges: 'Prepaid/Shipper',
        weight: 1,
        shipped: true,
        trackingNumber: '1Z999AA1234567890',
        carton1Count: 1,
        count1: 1,
        carton1Quantity: 1,
        u_internalShipNotes: 'Test shipment',
      }

      await expect(adapter.createJobShipment(params)).resolves.not.toThrow()
      expect(httpService.post).toHaveBeenCalledWith(
        'https://test-pace.com/rpc/rest/services/CreateObject/createJobShipment',
        expect.objectContaining(params),
        expect.any(Object)
      )
    })

    it('should handle authentication errors', async () => {
      const mockError = { response: { status: 401 } }
      jest.spyOn(httpService, 'post').mockImplementation(() => {
        throw mockError
      })

      const params = {
        job: 'GOVD-12345',
        // ... other required params
      }

      // Should retry once on 401 error
      await expect(adapter.createJobShipment(params)).rejects.toThrow()
    })
  })
})
```

### Integration Tests

```typescript
// test/pace-integration.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PaceModule } from '../src/pace/pace.module'
import { PaceOrderPort } from '../src/pace/domain/ports/pace-order.port'

describe('PACE Integration (e2e)', () => {
  let app: INestApplication
  let paceOrderPort: PaceOrderPort

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          // Use test environment variables
          envFilePath: '.env.test',
        }),
        PaceModule,
      ],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()

    paceOrderPort = app.get<PaceOrderPort>('PaceOrderPort')
  })

  afterAll(async () => {
    await app.close()
  })

  describe('createJobShipment', () => {
    it('should create a test shipment in PACE', async () => {
      const testParams = {
        job: 'GOVD-TEST001',
        shipmentType: 50,
        shipVia: 1, // UPS Ground
        quantity: 1,
        contactLastName: 'TestCustomer',
        contactFirstName: 'Test',
        address1: '123 Test Street',
        zip: '12345',
        city: 'Test City',
        country: 1,
        stateKey: '1:CA',
        dateTime: new Date().toISOString(),
        cost: 5.99,
        charges: 'Prepaid/Shipper',
        weight: 1,
        shipped: true,
        trackingNumber: `TEST${Date.now()}`,
        carton1Count: 1,
        count1: 1,
        carton1Quantity: 1,
        u_internalShipNotes: 'Integration test shipment',
      }

      // This should not throw if PACE API is properly configured
      await expect(paceOrderPort.createJobShipment(testParams)).resolves.not.toThrow()
    }, 30000) // 30 second timeout for API calls
  })
})
```

## Production Considerations

### Error Handling & Monitoring

```typescript
// src/pace/infrastructure/monitoring/pace-health.service.ts
import { Injectable, Logger } from '@nestjs/common'
import { Inject } from '@nestjs/common'
import { PaceOrderPort } from '../../domain/ports/pace-order.port'

@Injectable() 
export class PaceHealthService {
  private readonly logger = new Logger(PaceHealthService.name)

  constructor(
    @Inject('PaceOrderPort')
    private readonly paceOrderPort: PaceOrderPort
  ) {}

  /**
   * Health check for PACE API connectivity
   */
  async checkPaceHealth(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      // Attempt a simple PACE API call (implement based on available endpoints)
      // For example, you might have a test endpoint or read a test job
      
      return {
        status: 'healthy',
        details: { lastCheck: new Date().toISOString() }
      }
    } catch (error) {
      this.logger.error('PACE health check failed', error)
      return {
        status: 'unhealthy',
        details: { error: error.message, lastCheck: new Date().toISOString() }
      }
    }
  }
}
```

### Rate Limiting & Throttling

```typescript
// src/pace/infrastructure/services/pace-rate-limiter.service.ts
import { Injectable, Logger } from '@nestjs/common'

@Injectable()
export class PaceRateLimiterService {
  private readonly logger = new Logger(PaceRateLimiterService.name)
  private readonly requestQueue: Array<() => Promise<any>> = []
  private readonly maxConcurrentRequests = 5
  private activeRequests = 0
  private readonly requestDelay = 100 // ms between requests

  /**
   * Queue and execute PACE API requests with rate limiting
   */
  async executeWithRateLimit<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await request()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })

      this.processQueue()
    })
  }

  private async processQueue(): Promise<void> {
    if (this.activeRequests >= this.maxConcurrentRequests || this.requestQueue.length === 0) {
      return
    }

    const request = this.requestQueue.shift()
    if (!request) return

    this.activeRequests++

    try {
      await request()
    } catch (error) {
      this.logger.error('Rate limited request failed', error)
    } finally {
      this.activeRequests--
      
      // Delay before processing next request
      setTimeout(() => {
        this.processQueue()
      }, this.requestDelay)
    }
  }
}
```

### Configuration Validation

```typescript
// src/pace/infrastructure/config/pace-config.validation.ts
import { IsString, IsUrl, IsNotEmpty } from 'class-validator'
import { Transform } from 'class-transformer'

export class PaceConfigDto {
  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  PACE_BASE_URL: string

  @IsString()
  @IsNotEmpty()
  PACE_USERNAME: string

  @IsString()
  @IsNotEmpty()
  PACE_PASSWORD: string
}

// In your main module
import { ConfigModule } from '@nestjs/config'
import { validate } from 'class-validator'

ConfigModule.forRoot({
  validate: (config: Record<string, any>) => {
    const validatedConfig = new PaceConfigDto()
    Object.assign(validatedConfig, config)
    
    const errors = validate(validatedConfig)
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.toString()}`)
    }
    
    return validatedConfig
  },
})
```

### Logging & Observability

```typescript
// src/pace/infrastructure/logging/pace-logger.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap, catchError } from 'rxjs/operators'

@Injectable()
export class PaceLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PaceLoggingInterceptor.name)

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest()
    const method = request.method
    const url = request.url
    const startTime = Date.now()

    return next.handle().pipe(
      tap(() => {
        const endTime = Date.now()
        const duration = endTime - startTime
        this.logger.log(`${method} ${url} - ${duration}ms`)
      }),
      catchError((error) => {
        const endTime = Date.now()
        const duration = endTime - startTime
        this.logger.error(`${method} ${url} - ${duration}ms - ERROR: ${error.message}`)
        throw error
      })
    )
  }
}
```

## Summary

This guide provides a complete foundation for porting PACE API shipment functionality to another NestJS application. Key points:

1. **Clean Architecture**: Use ports and adapters pattern for maintainability
2. **Authentication**: Implement token caching and retry logic
3. **Data Mapping**: Create services for carrier and address transformations
4. **Error Handling**: Implement comprehensive error handling and logging
5. **Testing**: Include both unit and integration tests
6. **Production Ready**: Add monitoring, rate limiting, and configuration validation

### Next Steps

1. Implement the CSV parsing logic based on your specific CSV format
2. Customize the data transformation logic for your business requirements
3. Set up proper environment configuration
4. Add monitoring and alerting for production deployment
5. Test thoroughly with your actual PACE instance

The modular design allows you to adapt each component to your specific needs while maintaining the core PACE API integration functionality.