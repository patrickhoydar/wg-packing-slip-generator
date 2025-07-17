import { useState, useRef } from 'react';
import { CustomerStrategy, UploadResult, CustomerKit } from '../types/customerStrategy';

interface CustomerFileUploadProps {
  customer: CustomerStrategy;
  onUploadSuccess: (result: UploadResult) => void;
  onKitsGenerated: (kits: CustomerKit[]) => void;
}

export default function CustomerFileUpload({ customer, onUploadSuccess, onKitsGenerated }: CustomerFileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File) => {
    // Validate file type
    const fileExtension = selectedFile.name.toLowerCase().split('.').pop();
    if (!customer.instructions.acceptedFormats.includes(fileExtension || '')) {
      alert(`Invalid file type. Please upload: ${customer.instructions.acceptedFormats.join(', ').toUpperCase()}`);
      return;
    }

    // Validate file size
    if (selectedFile.size > customer.instructions.maxFileSize) {
      const maxSizeMB = Math.round(customer.instructions.maxFileSize / (1024 * 1024));
      alert(`File too large. Maximum size: ${maxSizeMB}MB`);
      return;
    }

    setFile(selectedFile);
    setUploadResult(null);
    
    // Automatically process the file after selection
    uploadFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      handleFileSelect(droppedFiles[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      handleFileSelect(selectedFiles[0]);
    }
  };

  const uploadFile = async (fileToUpload?: File) => {
    const targetFile = fileToUpload || file;
    if (!targetFile || !customer) return;

    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', targetFile);

      const response = await fetch(`http://localhost:3001/customers/${customer.customerCode}/upload`, {
        method: 'POST',
        body: formData,
      });

      const result: UploadResult = await response.json();
      
      if (response.ok && result.success) {
        setUploadResult(result);
        onUploadSuccess(result);
        
        if (result.data?.kits) {
          onKitsGenerated(result.data.kits);
        }
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadResult({
        success: false,
        message: error instanceof Error ? error.message : 'Upload failed'
      });
    } finally {
      setUploading(false);
    }
  };

  const resetUpload = () => {
    setFile(null);
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Upload {customer.displayName} File</h3>
        {file && (
          <button
            onClick={resetUpload}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        )}
      </div>

      {!file ? (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragOver 
              ? 'border-blue-400 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="space-y-4">
            <div className="text-4xl text-gray-400">📁</div>
            <div>
              <p className="text-lg font-medium text-gray-700">
                Drop your file here or click to browse
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Supports: {customer.instructions.acceptedFormats.join(', ').toUpperCase()} 
                (max {Math.round(customer.instructions.maxFileSize / (1024 * 1024))}MB)
              </p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Choose File
            </button>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept={customer.instructions.acceptedFormats.map(f => `.${f}`).join(',')}
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="text-2xl">📄</div>
              <div>
                <p className="font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {uploading ? (
                <div className="flex items-center space-x-2 px-4 py-2 bg-blue-100 text-blue-800 rounded-lg">
                  <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  <span className="text-sm font-medium">Processing...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg">
                  <div className="w-4 h-4 text-green-600">✓</div>
                  <span className="text-sm font-medium">Ready</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {uploadResult && (
        <div className={`p-4 rounded-lg border ${
          uploadResult.success 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <div className={`font-medium ${
            uploadResult.success ? 'text-green-800' : 'text-red-800'
          }`}>
            {uploadResult.success ? '✅ Success!' : '❌ Error'}
          </div>
          <p className={`text-sm mt-1 ${
            uploadResult.success ? 'text-green-700' : 'text-red-700'
          }`}>
            {uploadResult.message}
          </p>
          
          {uploadResult.success && uploadResult.data && (
            <div className="mt-3 text-sm text-green-700">
              <p>• Generated {uploadResult.data.kitsGenerated} packing slips</p>
              <p>• Processed {uploadResult.data.validation.validRows} of {uploadResult.data.validation.totalRows} rows</p>
              
              {uploadResult.data.validation.warnings.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium">Warnings:</p>
                  <ul className="list-disc list-inside">
                    {uploadResult.data.validation.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          
          {!uploadResult.success && uploadResult.data?.validation && (
            <div className="mt-3 text-sm text-red-700">
              {uploadResult.data.validation.errors.map((error, index) => (
                <p key={index}>• {error}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}