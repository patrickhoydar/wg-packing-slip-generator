import { useState, useEffect } from "react"
import { CustomerStrategy } from "../types/customerStrategy"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertCircle,
  RefreshCw,
  FileType,
  HardDrive,
  Columns,
} from "lucide-react"

interface CustomerSelectorProps {
  onCustomerSelect: (customer: CustomerStrategy | null) => void
  selectedCustomer: CustomerStrategy | null
}

export default function CustomerSelector({
  onCustomerSelect,
  selectedCustomer,
}: CustomerSelectorProps) {
  const [strategies, setStrategies] = useState<CustomerStrategy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAvailableStrategies()
  }, [])

  const fetchAvailableStrategies = async () => {
    try {
      setLoading(true)
      const response = await fetch("http://localhost:5001/customers/strategies")

      if (!response.ok) {
        throw new Error("Failed to fetch customer strategies")
      }

      const data = await response.json()
      setStrategies(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-24"></div>
            <div className="h-10 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm text-red-700">
              Error loading customers: {error}
            </span>
          </div>
          <Button
            onClick={fetchAvailableStrategies}
            variant="outline"
            size="sm"
            className="text-red-600 border-red-300 hover:bg-red-50"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Select Customer</Label>
        <Select
          value={selectedCustomer?.customerCode || ""}
          onValueChange={(value) => {
            if (value === "") {
              onCustomerSelect(null)
              return
            }
            const customer = strategies.find((s) => s.customerCode === value)
            onCustomerSelect(customer || null)
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Choose a customer..." />
          </SelectTrigger>
          <SelectContent>
            {strategies.map((strategy) => (
              <SelectItem
                key={strategy.customerCode}
                value={strategy.customerCode}
              >
                {strategy.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedCustomer && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Upload Requirements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <FileType className="w-4 h-4 text-muted-foreground" />
              <span>Formats:</span>
              <div className="flex gap-1">
                {selectedCustomer.instructions.acceptedFormats.map((format) => (
                  <Badge key={format} variant="outline" className="text-xs">
                    {format.toUpperCase()}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <HardDrive className="w-4 h-4 text-muted-foreground" />
              <span>Max size:</span>
              <Badge variant="secondary" className="text-xs">
                {Math.round(
                  selectedCustomer.instructions.maxFileSize / (1024 * 1024)
                )}
                MB
              </Badge>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Columns className="w-4 h-4 text-muted-foreground" />
              <span>Required columns:</span>
              <Badge variant="secondary" className="text-xs">
                {selectedCustomer.instructions.requiredColumns.length}
              </Badge>
            </div>

            {Array.isArray(
              selectedCustomer.instructions.sampleData?.specialNotes
            ) && (
              <div className="pt-2 border-t border-border">
                <p className="text-sm font-medium mb-2">Special Notes:</p>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  {(
                    selectedCustomer.instructions.sampleData
                      .specialNotes as string[]
                  ).map((note: string, index: number) => (
                    <li key={index}>• {note}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
