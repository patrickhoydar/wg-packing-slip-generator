import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/template.dto';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createTemplateDto: CreateTemplateDto) {
    return this.templatesService.create(createTemplateDto);
  }

  @Get()
  findAll(@Query('customerId') customerId?: string) {
    return this.templatesService.findAll(customerId);
  }

  @Get('default')
  findDefault(
    @Query('customerId') customerId?: string,
    @Query('customerCode') customerCode?: string,
  ) {
    return this.templatesService.findDefault(customerId, customerCode);
  }

  @Get('customer/:customerCode')
  findByCustomerCode(@Param('customerCode') customerCode: string) {
    return this.templatesService.findByCustomerCode(customerCode);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.templatesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTemplateDto: UpdateTemplateDto) {
    return this.templatesService.update(id, updateTemplateDto);
  }

  @Post(':id/duplicate')
  duplicate(@Param('id') id: string, @Body('name') name?: string) {
    return this.templatesService.duplicate(id, name);
  }

  @Get(':id/export')
  export(@Param('id') id: string) {
    return this.templatesService.export(id);
  }

  @Post('import')
  import(@Body() templateData: any) {
    return this.templatesService.import(templateData);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.templatesService.remove(id);
  }
}