import { OrderItem } from '../types/packingSlip';

interface ItemListProps {
  items: OrderItem[];
  showPrices?: boolean;
}

export default function ItemList({ items, showPrices = false }: ItemListProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  return (
    <div className="mb-8">
      <h3 className="text-md font-bold text-black mb-4">ORDER DETAILS</h3>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-black">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-black px-4 py-2 text-left text-sm font-bold text-black">Description</th>
              <th className="border border-black px-4 py-2 text-center text-sm font-bold text-black">Qty Ordered</th>
              {showPrices && (
                <>
                  <th className="border border-black px-4 py-2 text-right text-sm font-bold text-black">Unit Price</th>
                  <th className="border border-black px-4 py-2 text-right text-sm font-bold text-black">Total</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="even:bg-gray-50">
                <td className="border border-black px-4 py-2 text-sm text-black">{item.description}</td>
                <td className="border border-black px-4 py-2 text-center text-sm text-black font-medium">{item.quantity}</td>
                {showPrices && (
                  <>
                    <td className="border border-black px-4 py-2 text-right text-sm text-black">{formatPrice(item.unitPrice)}</td>
                    <td className="border border-black px-4 py-2 text-right text-sm text-black font-medium">{formatPrice(item.totalPrice)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 text-sm text-gray-700">
        <p><strong>Total Items:</strong> {items.length}</p>
        <p><strong>Total Quantity:</strong> {items.reduce((sum, item) => sum + item.quantity, 0)}</p>
      </div>
    </div>
  );
}