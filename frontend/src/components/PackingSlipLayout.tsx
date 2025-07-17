import { PackingSlip } from "../types/packingSlip"
import OrderHeader from "./OrderHeader"
import CustomerInformation from "./CustomerInformation"
import ItemList from "./ItemList"

interface PackingSlipLayoutProps {
  packingSlip: PackingSlip
  showPrices?: boolean
}

export default function PackingSlipLayout({
  packingSlip,
  showPrices = false,
}: PackingSlipLayoutProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <div className="packing-slip-container max-w-4xl mx-auto shadow-lg print:shadow-none print:max-w-none text-black text-sm">
      <div className="packing-slip-content p-8 print:p-8">
        {/* Top line with shipping address and PACKING LIST */}
        <div className="mb-6">
          <div className="flex items-end justify-between border-b border-black pb-2">
            <div>
              2450 Meadowbrook Pkwy Duluth, GA 30096, Phone: 877-415-7323
            </div>
            <h1 className="text-3xl font-bold text-black">PACKING LIST</h1>
          </div>
        </div>

        <OrderHeader order={packingSlip.order} />

        <CustomerInformation customer={packingSlip.order.customer} />

        <ItemList items={packingSlip.order.items} showPrices={showPrices} />

        <div className="mt-8 pt-6 border-t border-gray-400">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <div>
              <p>Generated on: {formatDate(packingSlip.generatedDate)}</p>
              <p>Job Number: 205544 - HH Global</p>
            </div>
            <div className="text-right">
              <p>Please verify all items before shipping</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
