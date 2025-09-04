import { IsString, IsOptional, IsBoolean, IsObject, IsArray, IsNumber } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  customerCode?: string;

  @IsArray()
  elements: any[];

  @IsObject()
  pageSettings: {
    width: number;
    height: number;
    margins: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
  };

  @IsOptional()
  @IsObject()
  styles?: any;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  createdBy?: string;

  @IsOptional()
  @IsObject()
  metadata?: any;
}

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  customerCode?: string;

  @IsOptional()
  @IsArray()
  elements?: any[];

  @IsOptional()
  @IsObject()
  pageSettings?: {
    width: number;
    height: number;
    margins: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
  };

  @IsOptional()
  @IsObject()
  styles?: any;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  version?: number;

  @IsOptional()
  @IsObject()
  metadata?: any;
}