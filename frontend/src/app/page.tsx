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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Download, Loader2, Plus } from "lucide-react"
import {
  CustomerStrategy,
  UploadResult,
  CustomerKit,
} from "../types/customerStrategy"

import Link from "next/link"

export default function Home() {
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerStrategy | null>(null)
  const [, setUploadResult] = useState<UploadResult | null>(null)
  const [generatedKits, setGeneratedKits] = useState<CustomerKit[]>([])
  const [activeTab, setActiveTab] = useState<"elements" | "customers">(
    "elements"
  )
  const [isGeneratingBatchPdf, setIsGeneratingBatchPdf] = useState(false)
  const [isCreatingJob, setIsCreatingJob] = useState(false)
  const [jobCreated, setJobCreated] = useState(false)
  const [jobNumber, setJobNumber] = useState<string>("")
  const [previewData, setPreviewData] = useState(dummyPackingSlip)

  const handleCustomerSelect = (customer: CustomerStrategy | null) => {
    setSelectedCustomer(customer)
    setUploadResult(null)
    setGeneratedKits([])
    setJobCreated(false)
    setJobNumber("")
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

    // Extract job number from the first kit if available
    if (kits.length > 0 && kits[0].jobNumber) {
      setJobNumber(kits[0].jobNumber)
    }

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

    console.log(selectedCustomer.customerCode)
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

  const createJob = async () => {
    if (
      !selectedCustomer ||
      !jobNumber ||
      generatedKits.length === 0 ||
      isCreatingJob
    ) {
      return
    }

    setIsCreatingJob(true)

    try {
      // We need to get the customer ID first
      const customerResponse = await fetch(`http://localhost:5001/customers`)

      if (!customerResponse.ok) {
        throw new Error("Failed to fetch customers")
      }

      const customers = await customerResponse.json()
      const customer = customers.find(
        (c: any) => c.customerCode === selectedCustomer.customerCode
      )

      if (!customer) {
        throw new Error("Customer not found")
      }

      // Now create the job
      const response = await fetch("http://localhost:5001/jobs/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobNumber: jobNumber,
          customerId: customer.id,
          customerCode: selectedCustomer.customerCode,
          kits: generatedKits,
          uploadedFileName: `${selectedCustomer.customerCode}-${jobNumber}-${new Date().toISOString().split("T")[0]}.csv`,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to create job")
      }

      const result = await response.json()

      if (result.success) {
        setJobCreated(true)
        alert(
          `Job ${jobNumber} created successfully with ${result.data.shipmentsCreated} shipments!`
        )
      } else {
        throw new Error(result.message || "Job creation failed")
      }
    } catch (error) {
      console.error("Error creating job:", error)
      alert(
        `Failed to create job: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    } finally {
      setIsCreatingJob(false)
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
                    <Badge variant="secondary">
                      {generatedKits.length} available
                    </Badge>
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
                        <SelectItem
                          key={`${kit.id}-${index}`}
                          value={index.toString()}
                        >
                          {index + 1}.{" "}
                          {kit.recipient.company || kit.recipient.name}
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

              {/* Create Job Section */}
              <Card className="border-blue-200 bg-blue-50/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-blue-800 flex items-center gap-2">
                    Create Job
                    {jobCreated && (
                      <Badge
                        variant="outline"
                        className="text-green-700 bg-green-50"
                      >
                        Created
                      </Badge>
                    )}
                  </CardTitle>
                  <p className="text-sm text-blue-700">
                    {jobNumber
                      ? `Create job "${jobNumber}" with ${generatedKits.length} shipments`
                      : "Job number not specified"}
                  </p>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={createJob}
                    disabled={isCreatingJob || jobCreated || !jobNumber}
                    className="w-full"
                    variant="outline"
                  >
                    {isCreatingJob ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating Job...
                      </>
                    ) : jobCreated ? (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Job Created Successfully
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Job
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
        <div className="space-y-4">
          {/* Packing Slip Editor Link */}
          <Card className="border-green-200 bg-green-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-green-800">
                Quick Packing Slip Editor
              </CardTitle>
              <p className="text-sm text-green-700">
                Create a packing slip with direct editing
              </p>
            </CardHeader>
            <CardContent>
              <Link href="/packing-slip-editor">
                <Button className="w-full" variant="default">
                  Open Packing Slip Editor
                </Button>
              </Link>
            </CardContent>
          </Card>
          
          {/* Template Editor Link */}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-blue-800">
                Advanced Template Editor
              </CardTitle>
              <p className="text-sm text-blue-700">
                Create reusable packing slip templates
              </p>
            </CardHeader>
            <CardContent>
              <Link href="/template-editor">
                <Button className="w-full" variant="outline">
                  Open Template Editor
                </Button>
              </Link>
            </CardContent>
          </Card>
          
          {/* Existing content */}
          {renderSidebarContent()}
        </div>
      </Sidebar>

      <PreviewPanel
        packingSlip={previewData}
        customerCode={selectedCustomer?.customerCode || "default"}
        useServerRendering={true}
      />
    </div>
  )
}
