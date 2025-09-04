import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/template.dto';

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTemplateDto: CreateTemplateDto) {
    try {
      // If this is set as default, unset other defaults for the same customer
      if (createTemplateDto.isDefault && createTemplateDto.customerId) {
        await this.prisma.template.updateMany({
          where: {
            customerId: createTemplateDto.customerId,
            isDefault: true,
          },
          data: {
            isDefault: false,
          },
        });
      }

      const template = await this.prisma.template.create({
        data: createTemplateDto,
        include: {
          customer: true,
        },
      });

      return {
        success: true,
        data: template,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to create template: ${error.message}`);
    }
  }

  async findAll(customerId?: string) {
    const where = customerId ? { customerId } : {};
    
    const templates = await this.prisma.template.findMany({
      where: {
        ...where,
        isActive: true,
      },
      include: {
        customer: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      success: true,
      data: templates,
    };
  }

  async findOne(id: string) {
    const template = await this.prisma.template.findUnique({
      where: { id },
      include: {
        customer: true,
      },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    return {
      success: true,
      data: template,
    };
  }

  async findByCustomerCode(customerCode: string) {
    const templates = await this.prisma.template.findMany({
      where: {
        customerCode,
        isActive: true,
      },
      include: {
        customer: true,
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return {
      success: true,
      data: templates,
    };
  }

  async findDefault(customerId?: string, customerCode?: string) {
    const where: any = { isDefault: true, isActive: true };
    
    if (customerId) {
      where.customerId = customerId;
    } else if (customerCode) {
      where.customerCode = customerCode;
    }

    const template = await this.prisma.template.findFirst({
      where,
      include: {
        customer: true,
      },
    });

    if (!template) {
      // Return a generic default if no specific default is found
      const genericDefault = await this.prisma.template.findFirst({
        where: {
          isDefault: true,
          isActive: true,
          customerId: null,
        },
      });

      if (!genericDefault) {
        throw new NotFoundException('No default template found');
      }

      return {
        success: true,
        data: genericDefault,
      };
    }

    return {
      success: true,
      data: template,
    };
  }

  async update(id: string, updateTemplateDto: UpdateTemplateDto) {
    // Check if template exists
    const existing = await this.prisma.template.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    try {
      // If setting as default, unset other defaults
      if (updateTemplateDto.isDefault && existing.customerId) {
        await this.prisma.template.updateMany({
          where: {
            customerId: existing.customerId,
            isDefault: true,
            id: { not: id },
          },
          data: {
            isDefault: false,
          },
        });
      }

      // Increment version if template structure is being updated
      if (updateTemplateDto.elements || updateTemplateDto.pageSettings) {
        updateTemplateDto.version = existing.version + 1;
      }

      const template = await this.prisma.template.update({
        where: { id },
        data: updateTemplateDto,
        include: {
          customer: true,
        },
      });

      return {
        success: true,
        data: template,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to update template: ${error.message}`);
    }
  }

  async duplicate(id: string, name?: string) {
    const original = await this.prisma.template.findUnique({
      where: { id },
    });

    if (!original) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    const duplicated = await this.prisma.template.create({
      data: {
        name: name || `${original.name} (Copy)`,
        customerId: original.customerId,
        customerCode: original.customerCode,
        elements: original.elements as any,
        pageSettings: original.pageSettings as any,
        styles: original.styles as any,
        isDefault: false,
        isActive: true,
        version: 1,
        createdBy: original.createdBy,
        metadata: original.metadata as any,
      },
      include: {
        customer: true,
      },
    });

    return {
      success: true,
      data: duplicated,
    };
  }

  async remove(id: string) {
    const template = await this.prisma.template.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    // Soft delete by setting isActive to false
    await this.prisma.template.update({
      where: { id },
      data: { isActive: false },
    });

    return {
      success: true,
      message: 'Template deleted successfully',
    };
  }

  async export(id: string) {
    const template = await this.prisma.template.findUnique({
      where: { id },
      include: {
        customer: true,
      },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    // Remove database-specific fields for export
    const { id: _, createdAt, updatedAt, ...exportData } = template;

    return {
      success: true,
      data: exportData,
    };
  }

  async import(templateData: any) {
    try {
      const { customer, ...data } = templateData;
      
      const template = await this.prisma.template.create({
        data: {
          ...data,
          version: 1,
        },
        include: {
          customer: true,
        },
      });

      return {
        success: true,
        data: template,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to import template: ${error.message}`);
    }
  }
}