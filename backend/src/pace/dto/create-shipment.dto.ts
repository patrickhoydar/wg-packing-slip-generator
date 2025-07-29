import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsNotEmpty,
  IsDateString,
} from 'class-validator';

export class CreateShipmentDto {
  @IsString()
  @IsNotEmpty()
  job: string;

  @IsString()
  @IsNotEmpty()
  id: string;

  @IsNumber()
  shipmentType: number;

  @IsNumber()
  shipVia: number;

  @IsNumber()
  quantity: number;

  @IsString()
  @IsNotEmpty()
  contactCompanyName: string;

  @IsString()
  @IsNotEmpty()
  contactLastName: string;

  @IsString()
  @IsNotEmpty()
  contactFirstName: string;

  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  address1: string;

  @IsString()
  @IsOptional()
  address2?: string;

  @IsString()
  @IsNotEmpty()
  zip: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsNumber()
  country: number;

  @IsString()
  @IsNotEmpty()
  stateKey: string;

  @IsDateString()
  dateTime: string;

  @IsNumber()
  cost: number;

  @IsString()
  @IsNotEmpty()
  charges: string;

  @IsNumber()
  weight: number;

  @IsBoolean()
  shipped: boolean;

  @IsString()
  @IsNotEmpty()
  trackingNumber: string;

  @IsNumber()
  carton1Count: number;

  @IsNumber()
  count1: number;

  @IsNumber()
  carton1Quantity: number;

  @IsString()
  @IsNotEmpty()
  u_internalShipNotes: string;

  @IsString()
  @IsOptional()
  accountNumber?: string;

  @IsBoolean()
  @IsOptional()
  forcedAccountNumber?: boolean;
}
