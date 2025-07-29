import { Order } from "../types/packingSlip"

interface OrderHeaderProps {
  order: Order
  jobInfo?: {
    jobNumber: string
  }
  shipmentInfo?: {
    shipmentId: string
  }
}

export default function OrderHeader({ order, jobInfo, shipmentInfo }: OrderHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="text-left">
          <p className="text-sm text-gray-700">
            Job No: {jobInfo?.jobNumber || 'N/A'}
          </p>
        </div>
        {shipmentInfo?.shipmentId && (
          <div className="text-right">
            <p className="text-sm text-gray-700">
              Shipment ID: {shipmentInfo.shipmentId}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
