import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PaceConfig } from '../config/pace.config';
import {
  CreateJobShipment,
  CreateJobShipmentResponse,
  ShipViaOption,
  ShipmentType,
} from './interfaces/pace.interface';
import {
  ErpService,
  ErpShipmentRequest,
  ErpShipmentResponse,
  ErpUpdateResponse,
} from '../erp/interfaces/erp-service.interface';

@Injectable()
export class PaceService implements ErpService {
  private readonly logger = new Logger(PaceService.name);
  private readonly paceConfig: PaceConfig;

  // Ship via mapping based on requirements document
  private readonly shipViaMapping: Map<string, number> = new Map([
    ['UPS:Ground', 1],
    ['FedEx:Ground', 5010],
    ['FedEx:International Economy', 5046],
    ['USPS:Ground Advantage', 5017],
    ['USPS:Express', 5056],
    ['USPS:Priority', 5096],
    ['USPS:First Class Flat', 5098],
  ]);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.paceConfig = this.configService.get<PaceConfig>('pace')!;
  }

  // Implement ErpService interface
  async createShipment(
    request: ErpShipmentRequest,
  ): Promise<ErpShipmentResponse> {
    const paceRequest = this.mapErpRequestToPace(request);
    const result = await this.createJobShipment(paceRequest);

    return {
      success: result.success,
      message: result.message || 'Operation completed',
      shipmentId: result.shipmentId,
      response: result.response,
      errors: result.errors,
    };
  }

  async updateShipment(id: string, data: any): Promise<ErpUpdateResponse> {
    // For now, PACE doesn't have a direct update shipment endpoint
    // This could be implemented if PACE adds this capability
    return {
      success: false,
      message: 'Update shipment not implemented for PACE',
      errors: ['Operation not supported'],
    };
  }

  async getShipment(id: string): Promise<any> {
    // For now, PACE doesn't have a direct get shipment endpoint
    // This could be implemented if PACE adds this capability
    throw new Error('Get shipment not implemented for PACE');
  }

  private mapErpRequestToPace(request: ErpShipmentRequest): CreateJobShipment {
    return {
      job: request.job,
      shipmentType: request.shipmentType,
      shipVia: request.shipVia,
      quantity: request.quantity,
      contactLastName: request.contactLastName,
      contactFirstName: request.contactFirstName,
      email: request.email,
      phone: request.phone,
      address1: request.address1,
      address2: request.address2,
      zip: request.zip,
      city: request.city,
      country: request.country,
      stateKey: request.stateKey,
      dateTime: request.dateTime,
      charges: request.charges,
      shipped: request.shipped,
      carton1Count: request.carton1Count,
      count1: request.count1,
      carton1Quantity: request.carton1Quantity,
      u_internalShipNotes: request.u_internalShipNotes?.substring(0, 255) || '',
      accountNumber: request.accountNumber,
      forcedAccountNumber: request.forcedAccountNumber,
    };
  }

  async createJobShipment(
    request: CreateJobShipment,
  ): Promise<CreateJobShipmentResponse> {
    try {
      this.logger.log(`Creating job shipment for job: ${request.job}`);

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.paceConfig.baseUrl}/CreateObject/createJobShipment`,
          request,
          {
            auth: {
              username: this.paceConfig.username,
              password: this.paceConfig.password,
            },
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      this.logger.log(`Successfully created shipment for job: ${request.job}`);

      return {
        success: true,
        message: 'Shipment created successfully',
        shipmentId: response.data?.id || response.data?.shipmentId,
        response: response.data,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to create shipment for job: ${request.id}`,
        error.stack,
      );

      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        'Unknown error occurred';

      return {
        success: false,
        message: errorMessage,
        errors: error.response?.data?.errors || [errorMessage],
      };
    }
  }

  async updateJobContact(createShipmentResponse: any, kit: any) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const jobContact = {
      id: createShipmentResponse.contactNumber,
      companyName: kit.recipient.company.substring(0, 60), // max 60 characters
    };

    console.log(jobContact);

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.paceConfig.baseUrl}/UpdateObject/updateContact`,
          jobContact,
          {
            auth: {
              username: this.paceConfig.username,
              password: this.paceConfig.password,
            },
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return {
        success: true,
        message: 'Job contact updated successfully',
        response: response.data,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to update job contact for job: ${createShipmentResponse.job}`,
        error.stack,
      );

      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        'Unknown error occurred';

      return {
        success: false,
        message: errorMessage,
        errors: error.response?.data?.errors || [errorMessage],
      };
    }
  }

  getShipViaOptions(): ShipViaOption[] {
    return Array.from(this.shipViaMapping.entries()).map(([key, id]) => {
      const [carrier, service] = key.split(':');
      return {
        id,
        carrier,
        service,
      };
    });
  }

  getShipmentTypes(): ShipmentType[] {
    // Based on requirements document, we know shipmentType 50 = standard outbound
    return [
      {
        id: 50,
        name: 'Standard Outbound',
        description: 'Standard outbound shipment',
      },
    ];
  }

  getShipViaId(carrier: string, service: string): number | null {
    const key = `${carrier}:${service}`;
    return this.shipViaMapping.get(key) || null;
  }

  /**
   * Helper method to format state key in PACE format "1:XX"
   */
  formatStateKey(state: string): string {
    return `1:${state.toUpperCase()}`;
  }

  /**
   * Helper method to create a standard shipment request with default values
   */
  createStandardShipmentRequest(
    data: Partial<CreateJobShipment>,
  ): CreateJobShipment {
    return {
      job: data.job || '',
      shipmentType: data.shipmentType || 50, // Standard outbound
      shipVia: data.shipVia || 1, // UPS Ground default
      quantity: data.quantity || 1,
      contactLastName: data.contactLastName || '',
      contactFirstName: data.contactFirstName || '',
      email: data.email || '',
      phone: data.phone || '',
      address1: data.address1 || '',
      address2: data.address2 || '',
      zip: data.zip || '',
      city: data.city || '',
      country: data.country || 1, // US default
      stateKey: data.stateKey || '1:',
      dateTime: data.dateTime || new Date().toISOString(),
      charges: data.charges || 'Prepaid/Shipper',
      shipped: data.shipped !== undefined ? data.shipped : true,
      carton1Count: data.carton1Count || 1,
      count1: data.count1 || 1,
      carton1Quantity: data.carton1Quantity || 1,
      u_internalShipNotes: data.u_internalShipNotes?.substring(0, 255) || '',
      accountNumber: data.accountNumber,
      forcedAccountNumber: data.forcedAccountNumber,
    };
  }
}
