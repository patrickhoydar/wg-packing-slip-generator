export interface ErpShipmentRequest {
  job: string;
  shipmentType: number;
  shipVia: number;
  quantity: number;
  contactLastName: string;
  contactFirstName: string;
  email: string;
  phone: string;
  address1: string;
  address2: string;
  zip: string;
  city: string;
  country: number;
  stateKey: string;
  dateTime: string;
  charges: string;
  shipped: boolean;
  carton1Count: number;
  count1: number;
  carton1Quantity: number;
  u_internalShipNotes: string;
  accountNumber?: string;
  forcedAccountNumber?: boolean;
}

export interface ErpShipmentResponse {
  success: boolean;
  message: string;
  shipmentId?: string;
  response?: any;
  errors?: string[];
}

export interface ErpUpdateResponse {
  success: boolean;
  message: string;
  response?: any;
  errors?: string[];
}

export interface ErpService {
  createShipment(request: ErpShipmentRequest): Promise<ErpShipmentResponse>;
  updateShipment(id: string, data: any): Promise<ErpUpdateResponse>;
  getShipment(id: string): Promise<any>;
  getShipViaOptions(): any[];
  getShipmentTypes(): any[];
}