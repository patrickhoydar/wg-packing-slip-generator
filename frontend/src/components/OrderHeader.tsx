import { Order } from "../types/packingSlip"

interface OrderHeaderProps {
  order: Order
}

export default function OrderHeader({ }: OrderHeaderProps) {


  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="text-left">
          <p className="text-sm text-gray-700">Job No: 205544 - HH Global</p>
        </div>
      </div>
    </div>
  )
}
