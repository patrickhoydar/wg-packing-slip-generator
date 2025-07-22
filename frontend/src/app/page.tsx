"use client"

import { useState } from "react"
import Sidebar from "../components/Sidebar"
import ElementsPanel from "../components/ElementsPanel"
import CustomerSelector from "../components/CustomerSelector"
import CustomerFileUpload from "../components/CustomerFileUpload"
import PreviewPanel from "../components/PreviewPanel"
import { dummyPackingSlip } from "../data/dummyData"
import {
  CustomerStrategy,
  UploadResult,
  CustomerKit,
} from "../types/customerStrategy"

export default function Home() {
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerStrategy | null>(null)
  const [, setUploadResult] = useState<UploadResult | null>(null)
  const [generatedKits, setGeneratedKits] = useState<CustomerKit[]>([])
  const [activeTab, setActiveTab] = useState<"elements" | "customers">(
    "elements"
  )
  const [isGeneratingBatchPdf, setIsGeneratingBatchPdf] = useState(false)
  const [previewData, setPreviewData] = useState(dummyPackingSlip)

  const handleCustomerSelect = (customer: CustomerStrategy | null) => {
    setSelectedCustomer(customer)
    setUploadResult(null)
    setGeneratedKits([])
    // Reset preview to dummy data when changing customers
    setPreviewData(dummyPackingSlip)
    if (customer) {
      setActiveTab("customers")
    }
  }

  const handleUploadSuccess = (result: UploadResult) => {
    setUploadResult(result)
  }

  const handleKitsGenerated = async (kits: CustomerKit[]) => {
    setGeneratedKits(kits)
    
    // Generate preview data for the first kit
    if (kits.length > 0 && selectedCustomer) {
      try {
        const response = await fetch(
          `http://localhost:5001/customers/${selectedCustomer.customerCode}/preview`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ kit: kits[0] }),
          }
        )
        
        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            setPreviewData(result.data)
          }
        }
      } catch (error) {
        console.error("Error generating preview:", error)
      }
    }
  }

  const downloadBatchPDFs = async () => {
    if (!selectedCustomer || generatedKits.length === 0 || isGeneratingBatchPdf)
      return

    setIsGeneratingBatchPdf(true)

    try {
      const response = await fetch(
        `http://localhost:5001/customers/${selectedCustomer.customerCode}/generate-pdfs`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ kits: generatedKits }),
        }
      )

      if (!response.ok) {
        throw new Error("Failed to generate PDFs")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${selectedCustomer.customerCode}-packing-slips-${new Date().toISOString().split("T")[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Error downloading PDFs:", error)
      alert("Failed to download PDFs. Please try again.")
    } finally {
      setIsGeneratingBatchPdf(false)
    }
  }

  const renderSidebarContent = () => {
    if (activeTab === "customers") {
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
            <div className="space-y-4">
              {/* Kit Selector for Preview */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">
                  Preview Kit ({generatedKits.length} available)
                </h4>
                <select
                  onChange={async (e) => {
                    const kitIndex = parseInt(e.target.value)
                    const kit = generatedKits[kitIndex]
                    if (kit && selectedCustomer) {
                      try {
                        const response = await fetch(
                          `http://localhost:5001/customers/${selectedCustomer.customerCode}/preview`,
                          {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({ kit }),
                          }
                        )
                        
                        if (response.ok) {
                          const result = await response.json()
                          if (result.success) {
                            setPreviewData(result.data)
                          }
                        }
                      } catch (error) {
                        console.error("Error generating preview:", error)
                      }
                    }
                  }}
                  className="w-full p-2 border border-blue-300 rounded-md text-sm text-gray-900"
                >
                  {generatedKits.map((kit, index) => (
                    <option key={kit.id} value={index} className="text-gray-900">
                      {index + 1}. {kit.recipient.company || kit.recipient.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Download Section */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">
                  Generated {generatedKits.length} Packing Slips
                </h4>
                <p className="text-sm text-green-700 mb-3">
                  Ready to download merged PDF file
                </p>
                <button
                  onClick={downloadBatchPDFs}
                  disabled={isGeneratingBatchPdf}
                  className={`w-full px-4 py-2 text-white rounded-lg transition-colors flex items-center justify-center ${
                    isGeneratingBatchPdf
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {isGeneratingBatchPdf ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Generating PDFs...
                    </>
                  ) : (
                    "Download Merged PDF"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )
    }

    return <ElementsPanel />
  }

  return (
    <div className="page-wrapper h-screen bg-gray-100 flex">
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as "elements" | "customers")}
      >
        {renderSidebarContent()}
      </Sidebar>

      <PreviewPanel packingSlip={previewData} />
    </div>
  )
}
