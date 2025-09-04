import { Template } from '@/types/template';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface TemplateResponse {
  success: boolean;
  data?: Template | Template[];
  message?: string;
}

export const templatesApi = {
  // Create a new template
  async create(template: Partial<Template>): Promise<TemplateResponse> {
    const response = await fetch(`${API_BASE_URL}/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(template),
    });
    return response.json();
  },

  // Get all templates
  async findAll(customerId?: string): Promise<TemplateResponse> {
    const url = customerId 
      ? `${API_BASE_URL}/templates?customerId=${customerId}`
      : `${API_BASE_URL}/templates`;
    
    const response = await fetch(url);
    return response.json();
  },

  // Get a single template by ID
  async findOne(id: string): Promise<TemplateResponse> {
    const response = await fetch(`${API_BASE_URL}/templates/${id}`);
    return response.json();
  },

  // Get templates by customer code
  async findByCustomerCode(customerCode: string): Promise<TemplateResponse> {
    const response = await fetch(`${API_BASE_URL}/templates/customer/${customerCode}`);
    return response.json();
  },

  // Get default template
  async findDefault(customerId?: string, customerCode?: string): Promise<TemplateResponse> {
    const params = new URLSearchParams();
    if (customerId) params.append('customerId', customerId);
    if (customerCode) params.append('customerCode', customerCode);
    
    const url = `${API_BASE_URL}/templates/default${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);
    return response.json();
  },

  // Update a template
  async update(id: string, updates: Partial<Template>): Promise<TemplateResponse> {
    const response = await fetch(`${API_BASE_URL}/templates/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    return response.json();
  },

  // Duplicate a template
  async duplicate(id: string, name?: string): Promise<TemplateResponse> {
    const response = await fetch(`${API_BASE_URL}/templates/${id}/duplicate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });
    return response.json();
  },

  // Export a template
  async export(id: string): Promise<TemplateResponse> {
    const response = await fetch(`${API_BASE_URL}/templates/${id}/export`);
    return response.json();
  },

  // Import a template
  async import(templateData: any): Promise<TemplateResponse> {
    const response = await fetch(`${API_BASE_URL}/templates/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(templateData),
    });
    return response.json();
  },

  // Delete a template
  async remove(id: string): Promise<TemplateResponse> {
    const response = await fetch(`${API_BASE_URL}/templates/${id}`, {
      method: 'DELETE',
    });
    return response.json();
  },
};