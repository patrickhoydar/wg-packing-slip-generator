'use client';

import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import ElementsPanel from '../components/ElementsPanel';
import CustomerSelector from '../components/CustomerSelector';
import CustomerFileUpload from '../components/CustomerFileUpload';
import PreviewPanel from '../components/PreviewPanel';
import { dummyPackingSlip } from '../data/dummyData';
import { CustomerStrategy, UploadResult, CustomerKit } from '../types/customerStrategy';

export default function Home() {
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerStrategy | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [generatedKits, setGeneratedKits] = useState<CustomerKit[]>([]);
  const [activeTab, setActiveTab] = useState<'elements' | 'customers'>('elements');

  const handleCustomerSelect = (customer: CustomerStrategy | null) => {
    setSelectedCustomer(customer);
    setUploadResult(null);
    setGeneratedKits([]);
    if (customer) {
      setActiveTab('customers');
    }
  };

  const handleUploadSuccess = (result: UploadResult) => {
    setUploadResult(result);
  };

  const handleKitsGenerated = (kits: CustomerKit[]) => {
    setGeneratedKits(kits);
  };

  const downloadBatchPDFs = async () => {
    if (!selectedCustomer || generatedKits.length === 0) return;

    try {
      const response = await fetch(`http://localhost:3001/customers/${selectedCustomer.customerCode}/generate-pdfs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ kits: generatedKits }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDFs');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedCustomer.customerCode}-batch-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading PDFs:', error);
      alert('Failed to download PDFs. Please try again.');
    }
  };

  const renderSidebarContent = () => {
    if (activeTab === 'customers') {
      return (
        <div className="space-y-4">
          <CustomerSelector 
            onCustomerSelect={handleCustomerSelect}
            selectedCustomer={selectedCustomer}
          />
          
          {selectedCustomer && (
            <CustomerFileUpload
              customer={selectedCustomer}
              onUploadSuccess={handleUploadSuccess}
              onKitsGenerated={handleKitsGenerated}
            />
          )}
          
          {generatedKits.length > 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-green-800 mb-2">
                Generated {generatedKits.length} Packing Slips
              </h4>
              <p className="text-sm text-green-700 mb-3">
                Ready to download batch PDF files
              </p>
              <button
                onClick={downloadBatchPDFs}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Download All PDFs (ZIP)
              </button>
            </div>
          )}
        </div>
      );
    }
    
    return <ElementsPanel />;
  };

  return (
    <div className="page-wrapper h-screen bg-gray-100 flex">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab}>
        {renderSidebarContent()}
      </Sidebar>
      
      <PreviewPanel packingSlip={dummyPackingSlip} />
    </div>
  );
}
