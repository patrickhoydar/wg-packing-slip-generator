import { useState, useEffect } from "react"
import { PackingSlip } from "../types/packingSlip"
import PackingSlipLayout from "./PackingSlipLayout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Printer, Download, Loader2 } from "lucide-react"

interface PreviewPanelProps {
  packingSlip: PackingSlip
  customerCode?: string
  useServerRendering?: boolean
}

export default function PreviewPanel({
  packingSlip,
  customerCode = "default",
  useServerRendering = true,
}: PreviewPanelProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [htmlPreview, setHtmlPreview] = useState<string>("")
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  // Fetch HTML preview from backend when data changes
  useEffect(() => {
    const fetchHtmlPreview = async () => {
      if (!useServerRendering) return

      console.log(packingSlip)

      setIsLoadingPreview(true)
      try {
        console.log(customerCode)
        const response = await fetch(
          `http://localhost:5001/pdf/preview-packing-slip?customerCode=${customerCode}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(packingSlip),
          }
        )

        if (response.ok) {
          const html = await response.text()
          setHtmlPreview(html)
        } else {
          console.error("Failed to fetch HTML preview")
          // Fallback to client-side rendering
          setHtmlPreview("")
        }
      } catch (error) {
        console.error("Error fetching HTML preview:", error)
        // Fallback to client-side rendering
        setHtmlPreview("")
      } finally {
        setIsLoadingPreview(false)
      }
    }

    if (useServerRendering && packingSlip) {
      fetchHtmlPreview()
    }
  }, [packingSlip, customerCode, useServerRendering])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const elementData = JSON.parse(e.dataTransfer.getData("application/json"))
    console.log("Dropped element:", elementData)
    // TODO: Handle element drop and positioning
  }

  const handleDownloadPdf = async () => {
    if (isGeneratingPdf) return // Prevent multiple clicks

    setIsGeneratingPdf(true)

    try {
      const response = await fetch(
        "http://localhost:5001/pdf/generate-packing-slip",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(packingSlip),
        }
      )

      if (!response.ok) {
        throw new Error("Failed to generate PDF")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `packing-slip-${packingSlip.order.orderNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Error downloading PDF:", error)
      alert("Failed to download PDF. Please try again.")
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  return (
    <div className="preview-panel flex-1 flex flex-col bg-muted/30">
      <div className="no-print p-4 bg-background border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Preview</h3>
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              <Badge variant="outline" className="text-xs">
                50%
              </Badge>
              <Badge variant="outline" className="text-xs mx-1">
                75%
              </Badge>
              <Badge variant="default" className="text-xs">
                100%
              </Badge>
            </div>
            <Button onClick={() => window.print()} variant="outline" size="sm">
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              size="sm"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {isGeneratingPdf ? "Generating PDF..." : "Download PDF"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 print:p-0">
        <div className="max-w-4xl mx-auto print:max-w-none print:mx-0">
          {isLoadingPreview ? (
            <div className="bg-background shadow-lg rounded-lg overflow-hidden p-8 text-center border">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Loading preview...</p>
            </div>
          ) : useServerRendering && htmlPreview ? (
            <div
              className="shadow-lg rounded-lg overflow-hidden drop-zone print:shadow-none print:rounded-none"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              style={{
                // Reset styles to let the server HTML take control
                background: "transparent",
                padding: 0,
                margin: 0,
              }}
            >
              <div
                dangerouslySetInnerHTML={{ __html: htmlPreview }}
                style={{
                  // Let the template control its own styling completely
                  width: "100%",
                  height: "auto",
                }}
              />
            </div>
          ) : (
            <div
              className="bg-background shadow-lg rounded-lg overflow-hidden drop-zone print:shadow-none print:rounded-none border"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <PackingSlipLayout packingSlip={packingSlip} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
