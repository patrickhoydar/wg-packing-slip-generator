import { Order } from '../types/packingSlip';

interface OrderHeaderProps {
  order: Order;
}

export default function OrderHeader({ order }: OrderHeaderProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'shipped': return 'bg-green-100 text-green-800';
      case 'delivered': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Packing Slip</h2>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
          {order.status.toUpperCase()}
        </span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <p className="text-sm text-gray-600">Order Number</p>
          <p className="text-lg font-semibold text-gray-900">{order.orderNumber}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Order Date</p>
          <p className="text-lg font-semibold text-gray-900">{formatDate(order.orderDate)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Shipping Date</p>
          <p className="text-lg font-semibold text-gray-900">{formatDate(order.shippingDate)}</p>
        </div>
      </div>
    </div>
  );
}