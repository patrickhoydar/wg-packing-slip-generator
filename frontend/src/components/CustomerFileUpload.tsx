import { useState, useRef } from "react"
import {
  CustomerStrategy,
  UploadResult,
  CustomerKit,
} from "../types/customerStrategy"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2, X } from "lucide-react"

interface CustomerFileUploadProps {
  customer: CustomerStrategy
  onUploadSuccess: (result: UploadResult) => void
  onKitsGenerated: (kits: CustomerKit[]) => void
}

export default function CustomerFileUpload({
  customer,
  onUploadSuccess,
  onKitsGenerated,
}: CustomerFileUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [jobNumber, setJobNumber] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (selectedFile: File) => {
    // Validate file type
    const fileExtension = selectedFile.name.toLowerCase().split(".").pop()
    if (!customer.instructions.acceptedFormats.includes(fileExtension || "")) {
      alert(
        `Invalid file type. Please upload: ${customer.instructions.acceptedFormats.join(", ").toUpperCase()}`
      )
      return
    }

    // Validate file size
    if (selectedFile.size > customer.instructions.maxFileSize) {
      const maxSizeMB = Math.round(
        customer.instructions.maxFileSize / (1024 * 1024)
      )
      alert(`File too large. Maximum size: ${maxSizeMB}MB`)
      return
    }

    setFile(selectedFile)
    setUploadResult(null)

    // Automatically process the file after selection
    uploadFile(selectedFile)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    if (droppedFiles.length > 0) {
      handleFileSelect(droppedFiles[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (selectedFiles && selectedFiles.length > 0) {
      handleFileSelect(selectedFiles[0])
    }
  }

  const uploadFile = async (fileToUpload?: File) => {
    const targetFile = fileToUpload || file
    if (!targetFile || !customer) return

    setUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", targetFile)
      if (jobNumber.trim()) {
        formData.append("jobNumber", jobNumber.trim())
      }

      const response = await fetch(
        `http://localhost:5001/customers/${customer.customerCode}/upload`,
        {
          method: "POST",
          body: formData,
        }
      )

      const result: UploadResult = await response.json()

      if (response.ok && result.success) {
        setUploadResult(result)
        onUploadSuccess(result)

        if (result.data?.kits) {
          onKitsGenerated(result.data.kits)
        }
      } else {
        throw new Error(result.message || "Upload failed")
      }
    } catch (error) {
      console.error("Upload error:", error)
      setUploadResult({
        success: false,
        message: error instanceof Error ? error.message : "Upload failed",
      })
    } finally {
      setUploading(false)
    }
  }

  const resetUpload = () => {
    setFile(null)
    setUploadResult(null)
    setJobNumber("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          Upload {customer.displayName} File
        </h3>
        {file && (
          <Button variant="ghost" size="sm" onClick={resetUpload}>
            <X className="w-4 h-4 mr-2" />
            Clear
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="job-number">Job Number (Optional)</Label>
        <Input
          id="job-number"
          type="text"
          value={jobNumber}
          onChange={(e) => setJobNumber(e.target.value)}
          placeholder="Enter job number..."
        />
      </div>

      {!file ? (
        <Card
          className={`border-2 border-dashed transition-colors cursor-pointer hover:border-primary/50 ${
            dragOver ? "border-primary bg-primary/5" : ""
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <CardContent className="p-8 text-center space-y-4">
            <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
            <div className="space-y-2">
              <p className="text-lg font-medium text-foreground">
                Drop your file here or click to browse
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {customer.instructions.acceptedFormats.map((format) => (
                  <Badge key={format} variant="secondary">
                    {format.toUpperCase()}
                  </Badge>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Maximum file size: {Math.round(customer.instructions.maxFileSize / (1024 * 1024))}MB
              </p>
            </div>
            <Button>
              <Upload className="w-4 h-4 mr-2" />
              Choose File
            </Button>
          </CardContent>

          <input
            ref={fileInputRef}
            type="file"
            accept={customer.instructions.acceptedFormats
              .map((f) => `.${f}`)
              .join(",")}
            onChange={handleFileInputChange}
            className="hidden"
          />
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <FileText className="w-8 h-8 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground break-words">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
                <div className="mt-2">
                  {uploading ? (
                    <Badge variant="secondary" className="gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </Badge>
                  ) : (
                    <Badge variant="default" className="gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Ready
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {uploadResult && (
        <Card className={uploadResult.success ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              {uploadResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              <span className={`font-medium ${
                uploadResult.success ? "text-green-800" : "text-red-800"
              }`}>
                {uploadResult.success ? "Success!" : "Error"}
              </span>
            </div>
            <p className={`text-sm ${
              uploadResult.success ? "text-green-700" : "text-red-700"
            }`}>
              {uploadResult.message}
            </p>

            {uploadResult.success && uploadResult.data && (
              <div className="mt-3 text-sm text-green-700 space-y-1">
                <p>• Generated {uploadResult.data.kitsGenerated} packing slips</p>
                <p>
                  • Processed {uploadResult.data.validation.validRows} of{" "}
                  {uploadResult.data.validation.totalRows} rows
                </p>

                {uploadResult.data.validation.warnings.length > 0 && (
                  <div className="mt-2">
                    <p className="font-medium">Warnings:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {uploadResult.data.validation.warnings.map(
                        (warning, index) => (
                          <li key={index}>{warning}</li>
                        )
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {!uploadResult.success && uploadResult.data?.validation && (
              <div className="mt-3 text-sm text-red-700 space-y-1">
                {uploadResult.data.validation.errors.map((error, index) => (
                  <p key={index}>• {error}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
