import { PackingSlip } from '../types/packingSlip';
import CompanyHeader from './CompanyHeader';
import OrderHeader from './OrderHeader';
import CustomerInformation from './CustomerInformation';
import ItemList from './ItemList';

interface PackingSlipLayoutProps {
  packingSlip: PackingSlip;
  showPrices?: boolean;
}

export default function PackingSlipLayout({ packingSlip, showPrices = false }: PackingSlipLayoutProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="packing-slip-container max-w-4xl mx-auto bg-white shadow-lg print:shadow-none print:max-w-none">
      <div className="packing-slip-content p-8 print:p-8">
        <CompanyHeader company={packingSlip.company} />
        
        <OrderHeader order={packingSlip.order} />
        
        <CustomerInformation customer={packingSlip.order.customer} />
        
        <ItemList items={packingSlip.order.items} showPrices={showPrices} />
        
        {packingSlip.notes && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="text-sm font-medium text-yellow-800 mb-2">Special Instructions:</h4>
            <p className="text-sm text-yellow-700">{packingSlip.notes}</p>
          </div>
        )}
        
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <div>
              <p>Generated on: {formatDate(packingSlip.generatedDate)}</p>
              <p>Packing Slip ID: {packingSlip.id}</p>
            </div>
            <div className="text-right">
              <p>Please verify all items before shipping</p>
              <p>Contact us at {packingSlip.company.email} for any questions</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}