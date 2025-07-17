import { Customer } from "../types/packingSlip"

interface CustomerInformationProps {
  customer: Customer
}

export default function CustomerInformation({
  customer,
}: CustomerInformationProps) {
  return (
    <div className="mb-8">
      <div>
        <h3 className="text-md font-bold text-black mb-3">Ship To:</h3>
        <div className="text-sm text-gray-800">
          <p className="font-medium">{customer.name}</p>
          <p>{customer.shippingAddress.street}</p>
          <p>
            {customer.shippingAddress.city}, {customer.shippingAddress.state}{" "}
            {customer.shippingAddress.zipCode}
          </p>
          <p>{customer.shippingAddress.country}</p>
          <p>{customer.email}</p>
        </div>
      </div>
    </div>
  )
}
