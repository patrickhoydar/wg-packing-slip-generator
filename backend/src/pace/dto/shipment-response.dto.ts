export class ShipmentResponseDto {
  success: boolean;
  message?: string;
  shipmentId?: string;
  errors?: string[];
}

export class ShipViaOptionDto {
  id: number;
  carrier: string;
  service: string;
}

export class ShipmentTypeDto {
  id: number;
  name: string;
  description?: string;
}
