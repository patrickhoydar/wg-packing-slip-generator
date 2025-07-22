"use client"

import { useState } from "react"
import Sidebar from "../components/Sidebar"
import ElementsPanel from "../components/ElementsPanel"
import CustomerSelector from "../components/CustomerSelector"
import CustomerFileUpload from "../components/CustomerFileUpload"
import PreviewPanel from "../components/PreviewPanel"
import { dummyPackingSlip } from "../data/dummyData"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, Loader2 } from "lucide-react"
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
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    Preview Kit
                    <Badge variant="secondary">{generatedKits.length} available</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    onValueChange={async (value) => {
                      const kitIndex = parseInt(value)
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
                    defaultValue="0"
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {generatedKits.map((kit, index) => (
                        <SelectItem key={kit.id} value={index.toString()}>
                          {index + 1}. {kit.recipient.company || kit.recipient.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Download Section */}
              <Card className="border-green-200 bg-green-50/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-green-800 flex items-center gap-2">
                    Generated Packing Slips
                    <Badge variant="outline" className="text-green-700">
                      {generatedKits.length}
                    </Badge>
                  </CardTitle>
                  <p className="text-sm text-green-700">
                    Ready to download merged PDF file
                  </p>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={downloadBatchPDFs}
                    disabled={isGeneratingBatchPdf}
                    className="w-full"
                    variant="default"
                  >
                    {isGeneratingBatchPdf ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating PDFs...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Download Merged PDF
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )
    }

    return <ElementsPanel />
  }

  return (
    <div className="page-wrapper h-screen bg-muted/30 flex">
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as "elements" | "customers")}
      >
        {renderSidebarContent()}
      </Sidebar>

      <PreviewPanel 
        packingSlip={previewData} 
        customerCode={selectedCustomer?.customerCode || 'default'}
        useServerRendering={true}
      />
    </div>
  )
}
