import { useState, useEffect } from 'react';
import { PackingSlip } from '../types/packingSlip';
import PackingSlipLayout from './PackingSlipLayout';

interface PreviewPanelProps {
  packingSlip: PackingSlip;
  customerCode?: string;
  useServerRendering?: boolean;
}

export default function PreviewPanel({ 
  packingSlip, 
  customerCode = 'default',
  useServerRendering = true 
}: PreviewPanelProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [htmlPreview, setHtmlPreview] = useState<string>('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Fetch HTML preview from backend when data changes
  useEffect(() => {
    if (useServerRendering && packingSlip) {
      fetchHtmlPreview();
    }
  }, [packingSlip, customerCode, useServerRendering]);

  const fetchHtmlPreview = async () => {
    if (!useServerRendering) return;
    
    setIsLoadingPreview(true);
    try {
      const response = await fetch(`http://localhost:5001/pdf/preview-packing-slip?customerCode=${customerCode}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(packingSlip),
      });

      if (response.ok) {
        const html = await response.text();
        setHtmlPreview(html);
      } else {
        console.error('Failed to fetch HTML preview');
        // Fallback to client-side rendering
        setHtmlPreview('');
      }
    } catch (error) {
      console.error('Error fetching HTML preview:', error);
      // Fallback to client-side rendering
      setHtmlPreview('');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const elementData = JSON.parse(e.dataTransfer.getData('application/json'));
    console.log('Dropped element:', elementData);
    // TODO: Handle element drop and positioning
  };

  const handleDownloadPdf = async () => {
    if (isGeneratingPdf) return; // Prevent multiple clicks
    
    setIsGeneratingPdf(true);
    
    try {
      const response = await fetch('http://localhost:5001/pdf/generate-packing-slip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(packingSlip),
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `packing-slip-${packingSlip.order.orderNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to download PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="preview-panel flex-1 flex flex-col bg-gray-50">
      <div className="no-print p-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Preview</h3>
          <div className="flex items-center space-x-2">
            <button className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
              50%
            </button>
            <button className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
              75%
            </button>
            <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
              100%
            </button>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Print
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className={`px-4 py-2 text-white rounded-lg transition-colors flex items-center space-x-2 ${
                isGeneratingPdf 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {isGeneratingPdf && (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 print:p-0">
        <div className="max-w-4xl mx-auto print:max-w-none print:mx-0">
          {isLoadingPreview ? (
            <div className="bg-white shadow-lg rounded-lg overflow-hidden p-8 text-center">
              <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-500">Loading preview...</p>
            </div>
          ) : useServerRendering && htmlPreview ? (
            <div 
              className="shadow-lg rounded-lg overflow-hidden drop-zone print:shadow-none print:rounded-none"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              style={{
                // Reset styles to let the server HTML take control
                background: 'transparent',
                padding: 0,
                margin: 0
              }}
            >
              <div 
                dangerouslySetInnerHTML={{ __html: htmlPreview }}
                style={{
                  // Let the template control its own styling completely
                  width: '100%',
                  height: 'auto'
                }}
              />
            </div>
          ) : (
            <div 
              className="bg-white shadow-lg rounded-lg overflow-hidden drop-zone print:shadow-none print:rounded-none"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <PackingSlipLayout packingSlip={packingSlip} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}