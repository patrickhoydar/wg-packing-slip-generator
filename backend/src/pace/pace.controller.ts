import {
  Controller,
  Post,
  Get,
  Body,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { PaceService } from './pace.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import {
  ShipmentResponseDto,
  ShipViaOptionDto,
  ShipmentTypeDto,
} from './dto/shipment-response.dto';

@Controller('pace')
export class PaceController {
  constructor(private readonly paceService: PaceService) {}

  @Post('shipments')
  async createShipment(
    @Body() createShipmentDto: CreateShipmentDto,
  ): Promise<ShipmentResponseDto> {
    try {
      const result =
        await this.paceService.createJobShipment(createShipmentDto);

      if (!result.success) {
        throw new HttpException(
          {
            message: result.message,
            errors: result.errors,
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          message: 'Failed to create shipment',
          errors: [error.message],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('ship-via-options')
  getShipViaOptions(): ShipViaOptionDto[] {
    return this.paceService.getShipViaOptions();
  }

  @Get('shipment-types')
  getShipmentTypes(): ShipmentTypeDto[] {
    return this.paceService.getShipmentTypes();
  }
}
