import { Customer } from '../types/packingSlip';

interface CustomerInformationProps {
  customer: Customer;
}

export default function CustomerInformation({ customer }: CustomerInformationProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Billing Address</h3>
        <div className="text-sm text-gray-700">
          <p className="font-medium">{customer.name}</p>
          <p>{customer.billingAddress.street}</p>
          <p>{customer.billingAddress.city}, {customer.billingAddress.state} {customer.billingAddress.zipCode}</p>
          <p>{customer.billingAddress.country}</p>
          <div className="mt-2 pt-2 border-t border-gray-200">
            <p>Phone: {customer.phone}</p>
            <p>Email: {customer.email}</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Shipping Address</h3>
        <div className="text-sm text-gray-700">
          <p className="font-medium">{customer.name}</p>
          <p>{customer.shippingAddress.street}</p>
          <p>{customer.shippingAddress.city}, {customer.shippingAddress.state} {customer.shippingAddress.zipCode}</p>
          <p>{customer.shippingAddress.country}</p>
        </div>
      </div>
    </div>
  );
}