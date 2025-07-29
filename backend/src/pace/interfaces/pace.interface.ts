export interface CreateJobShipment {
  id?: string;
  job: string;
  shipmentType: number;
  shipVia: number;
  quantity: number;
  contactLastName: string;
  contactFirstName: string;
  email: string;
  phone: string;
  address1: string;
  address2?: string;
  zip: string;
  city: string;
  country: number;
  stateKey: string;
  dateTime: string;
  shipped: boolean;
  charges: string;
  carton1Count: number;
  count1: number;
  carton1Quantity: number;
  u_internalShipNotes: string;
  accountNumber?: string;
  forcedAccountNumber?: boolean;
}

export interface CreateJobShipmentResponse {
  success: boolean;
  message?: string;
  shipmentId?: string;
  jobContact?: any;
  response?: any;
  errors?: string[];
}

export interface ShipViaOption {
  id: number;
  carrier: string;
  service: string;
}

export interface ShipmentType {
  id: number;
  name: string;
  description?: string;
}

export interface PaceApiError {
  message: string;
  code?: string;
  details?: any;
}
