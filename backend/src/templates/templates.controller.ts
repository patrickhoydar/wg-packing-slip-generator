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
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/template.dto';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

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

  // Handlebars template endpoints
  @Get('handlebars/:templateName')
  async getHandlebarsTemplate(
    @Param('templateName') templateName: string,
    @Res() res: Response,
  ) {
    try {
      const templatesDir = path.join(__dirname, '../../views/templates');
      const templatePath = path.join(templatesDir, `${templateName}.hbs`);

      if (!fs.existsSync(templatePath)) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const templateContent = fs.readFileSync(templatePath, 'utf-8');
      res.type('text/plain').send(templateContent);
    } catch (error) {
      res.status(500).json({ error: 'Failed to load template' });
    }
  }

  @Get('handlebars')
  async listHandlebarsTemplates() {
    try {
      const templatesDir = path.join(__dirname, '../../views/templates');
      const files = fs.readdirSync(templatesDir);
      const templates = files
        .filter((file) => file.endsWith('.hbs'))
        .map((file) => ({
          id: file.replace('.hbs', ''),
          name: file
            .replace('.hbs', '')
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (l) => l.toUpperCase()),
          filename: file,
        }));

      return templates;
    } catch (error) {
      return [];
    }
  }

  @Post('preview')
  async previewTemplate(@Body() body: { template: string; data: any; templateName?: string }) {
    try {
      const { template, data, templateName } = body;

      // Register Handlebars helpers
      Handlebars.registerHelper('eq', function (a: any, b: any) {
        return a === b;
      });

      Handlebars.registerHelper('log', function (context: any) {
        console.log(context);
      });

      Handlebars.registerHelper('add', function (a: number, b: number) {
        return a + b;
      });

      Handlebars.registerHelper('subtract', function (a: number, b: number) {
        return a - b;
      });

      Handlebars.registerHelper('multiply', function (a: number, b: number) {
        return a * b;
      });

      Handlebars.registerHelper('divide', function (a: number, b: number) {
        return a / b;
      });

      Handlebars.registerHelper('formatCurrency', function (value: number) {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(value);
      });

      // Compile and render template
      const compiledTemplate = Handlebars.compile(template);
      const html = compiledTemplate(data);

      // Load specific CSS files based on template name
      let cssContent = '';
      if (templateName === 'scholastic') {
        // Read the CSS file for Scholastic template
        const stylesDir = path.join(__dirname, '../../views/styles');
        try {
          const scholasticCSS = fs.readFileSync(
            path.join(stylesDir, 'scholastic.css'),
            'utf-8'
          );
          cssContent = scholasticCSS;
        } catch (err) {
          console.error('Failed to load Scholastic CSS:', err);
          // Use fallback styles if CSS file not found
          cssContent = `
            body { font-family: Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; }
          `;
        }
      } else if (templateName === 'packing-slip') {
        // Read the CSS files for packing slip
        const stylesDir = path.join(__dirname, '../../views/styles');
        try {
          const baseCSS = fs.readFileSync(
            path.join(stylesDir, 'packing-slip-base-api.css'),
            'utf-8'
          );
          const printCSS = fs.readFileSync(
            path.join(stylesDir, 'packing-slip-print-api.css'),
            'utf-8'
          );
          cssContent = baseCSS + '\n' + printCSS;
        } catch (err) {
          console.error('Failed to load CSS files:', err);
        }
      } else if (templateName === 'inquired') {
        // Load InquirED specific styles if they exist
        const stylesDir = path.join(__dirname, '../../views/styles');
        try {
          const inquiredCSS = fs.readFileSync(
            path.join(stylesDir, 'inquired.css'),
            'utf-8'
          );
          cssContent = inquiredCSS;
        } catch (err) {
          // Use default styles if specific styles don't exist
          cssContent = `
            body { font-family: Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
            .ship-to { background-color: #f9f9f9; padding: 15px; margin: 20px 0; }
            .center { text-align: center; }
            .qty { font-weight: bold; }
            .packing-slip-container { max-width: 1000px; margin: 0 auto; }
            .packing-slip-content { padding: 20px; }
            .header-border { border-bottom: 2px solid #000; padding-bottom: 10px; }
            .company-info { font-size: 12px; }
            .packing-list-title { font-size: 24px; font-weight: bold; }
            .job-info { margin: 20px 0; }
            .job-number, .shipment-id, .box-number { font-size: 14px; }
            .ship-to-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; }
            .ship-to-details { margin-bottom: 20px; }
            .company-name { font-weight: bold; }
            .delivery-requirements { background: #f5f5f5; padding: 15px; margin: 20px 0; }
            .delivery-row { display: flex; justify-content: space-between; margin: 5px 0; }
            .delivery-col { flex: 1; }
            .order-details-title { font-size: 18px; font-weight: bold; margin: 20px 0 10px; }
            .order-table { width: 100%; }
            .order-summary { margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; }
            .footer-content { display: flex; justify-content: space-between; font-size: 12px; }
            .bg-gray-50 { background-color: #f9f9f9; }
          `;
        }
      } else {
        // Default styles for other templates
        cssContent = `
          body { font-family: Arial, sans-serif; padding: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
          .ship-to { background-color: #f9f9f9; padding: 15px; margin: 20px 0; }
          .center { text-align: center; }
          .qty { font-weight: bold; }
        `;
      }

      // Build the final HTML with styles
      const styledHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Template Preview</title>
          <style>
            ${cssContent}
          </style>
        </head>
        <body>
          ${html}
        </body>
        </html>
      `;

      return styledHtml;
    } catch (error) {
      console.error('Preview error:', error);
      return '<div>Error rendering template</div>';
    }
  }
}