import {
  Customer,
  Order,
  Company,
  PackingSlip,
  OrderItem,
} from "../types/packingSlip"

export const dummyCompany: Company = {
  name: "Wallace Graphics",
  address: {
    street: "123 Business Ave",
    city: "Business City",
    state: "NY",
    zipCode: "12345",
    country: "US",
  },
  phone: "(555) 123-4567",
  email: "orders@wallacegraphics.com",
  website: "www.wallacegraphics.com",
}

export const dummyCustomer: Customer = {
  id: "cust-001",
  name: "John Smith",
  email: "john.smith@example.com",
  phone: "(555) 987-6543",
  billingAddress: {
    street: "456 Oak Street",
    city: "Springfield",
    state: "IL",
    zipCode: "62701",
    country: "US",
  },
  shippingAddress: {
    street: "789 Pine Avenue",
    city: "Springfield",
    state: "IL",
    zipCode: "62702",
    country: "US",
  },
}

export const dummyOrderItems: OrderItem[] = [
  {
    id: "item-001",
    sku: "BRO-001",
    name: "Business Cards",
    description: "Premium business cards, 16pt cardstock, matte finish",
    quantity: 1000,
    unitPrice: 0.12,
    totalPrice: 120.0,
  },
  {
    id: "item-002",
    sku: "FLY-002",
    name: "Flyers",
    description: "Full-color flyers, 100lb text paper, UV coating",
    quantity: 500,
    unitPrice: 0.35,
    totalPrice: 175.0,
  },
  {
    id: "item-003",
    sku: "BAN-003",
    name: "Vinyl Banner",
    description: "3ft x 6ft vinyl banner with grommets",
    quantity: 2,
    unitPrice: 45.0,
    totalPrice: 90.0,
  },
]

export const dummyOrder: Order = {
  id: "ord-001",
  orderNumber: "WG-2025-001",
  orderDate: "2025-07-01",
  shippingDate: "2025-07-08",
  customer: dummyCustomer,
  items: dummyOrderItems,
  subtotal: 385.0,
  tax: 30.8,
  shipping: 15.0,
  total: 430.8,
  status: "processing",
}

export const dummyPackingSlip: PackingSlip = {
  id: "ps-001",
  order: dummyOrder,
  company: dummyCompany,
  generatedDate: "2025-07-08",
  notes: "Handle with care - fragile items included",
}
