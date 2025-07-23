interface DeliveryInfo {
  hasDock?: boolean
  hasPavedPath?: boolean
  receivingDays?: string
  receivingHours?: string
  deliveryNotes?: string
  shipDate?: string
  appointmentRequired?: boolean
}

interface DeliveryRequirementsProps {
  deliveryInfo: DeliveryInfo
  shippingMethod: string
}

export default function DeliveryRequirements({
  deliveryInfo,
  shippingMethod,
}: DeliveryRequirementsProps) {
  if (!deliveryInfo) {
    return null
  }

  return (
    <div className="mb-4 bg-gray-50 border border-gray-300 p-3">
      <div className="space-y-2">
        {/* Top row: Two columns */}
        <div className="flex">
          {/* Left column: Shipping Method */}
          <div className="flex-1 pr-6">
            <p className="text-sm text-black">
              <strong>Shipping Method:</strong> {shippingMethod}
            </p>
            {deliveryInfo.appointmentRequired && (
              <p className="text-sm text-black mt-1">
                <strong>⚠️ APPOINTMENT REQUIRED</strong>
              </p>
            )}
          </div>

          {/* Right column: Earliest Date and Receiving info */}
          <div className="flex-1 space-y-0.5">
            {deliveryInfo.shipDate && (
              <p className="text-sm text-black">
                <strong>Ship Date:</strong> {deliveryInfo.shipDate}
              </p>
            )}
            <p className="text-sm text-black">
              <strong>Receiving Days:</strong>{" "}
              {deliveryInfo.receivingDays || "M-F"}
            </p>
            <p className="text-sm text-black">
              <strong>Receiving Hours:</strong>{" "}
              {deliveryInfo.receivingHours || "8 AM - 4 PM"}
            </p>
          </div>
        </div>

        {/* Full width delivery notes section */}
        {deliveryInfo.deliveryNotes && (
          <div className="pt-1.5 border-t border-gray-200">
            <p className="text-sm text-black">
              <strong>Special Notes:</strong> {deliveryInfo.deliveryNotes}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
