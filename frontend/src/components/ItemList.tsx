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
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Items to Ship</h3>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-300 px-4 py-2 text-left text-sm font-medium text-gray-900">SKU</th>
              <th className="border border-gray-300 px-4 py-2 text-left text-sm font-medium text-gray-900">Item</th>
              <th className="border border-gray-300 px-4 py-2 text-left text-sm font-medium text-gray-900">Description</th>
              <th className="border border-gray-300 px-4 py-2 text-center text-sm font-medium text-gray-900">Quantity</th>
              {showPrices && (
                <>
                  <th className="border border-gray-300 px-4 py-2 text-right text-sm font-medium text-gray-900">Unit Price</th>
                  <th className="border border-gray-300 px-4 py-2 text-right text-sm font-medium text-gray-900">Total</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-900 font-mono">{item.sku}</td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-900 font-medium">{item.name}</td>
                <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700">{item.description}</td>
                <td className="border border-gray-300 px-4 py-2 text-center text-sm text-gray-900 font-medium">{item.quantity}</td>
                {showPrices && (
                  <>
                    <td className="border border-gray-300 px-4 py-2 text-right text-sm text-gray-900">{formatPrice(item.unitPrice)}</td>
                    <td className="border border-gray-300 px-4 py-2 text-right text-sm text-gray-900 font-medium">{formatPrice(item.totalPrice)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 text-sm text-gray-600">
        <p>Total Items: {items.length}</p>
        <p>Total Quantity: {items.reduce((sum, item) => sum + item.quantity, 0)}</p>
      </div>
    </div>
  );
}