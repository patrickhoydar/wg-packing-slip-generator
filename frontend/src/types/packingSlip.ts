export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  billingAddress: Address;
  shippingAddress: Address;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface OrderItem {
  id: string;
  sku: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  orderDate: string;
  shippingDate: string;
  customer: Customer;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered';
}

export interface Company {
  name: string;
  logo?: string;
  address: Address;
  phone: string;
  email: string;
  website: string;
}

export interface PackingSlip {
  id: string;
  order: Order;
  company: Company;
  generatedDate: string;
  notes?: string;
}