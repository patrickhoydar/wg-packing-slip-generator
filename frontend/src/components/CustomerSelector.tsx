import { useState, useEffect } from "react"
import { CustomerStrategy } from "../types/customerStrategy"

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
      const response = await fetch("http://localhost:3001/customers/strategies")

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

  const handleCustomerChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const selectedCode = event.target.value

    if (selectedCode === "") {
      onCustomerSelect(null)
      return
    }

    const customer = strategies.find((s) => s.customerCode === selectedCode)
    onCustomerSelect(customer || null)
  }

  if (loading) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-24 mb-2"></div>
          <div className="h-10 bg-gray-300 rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700 text-sm">Error loading customers: {error}</p>
        <button
          onClick={fetchAvailableStrategies}
          className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <label
        htmlFor="customer-select"
        className="block text-sm font-medium text-black-500 mb-2"
      >
        Select Customer
      </label>

      <select
        id="customer-select"
        value={selectedCustomer?.customerCode || ""}
        onChange={handleCustomerChange}
        className="w-full px-3 py-2 border text-black border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">Choose a customer...</option>
        {strategies.map((strategy) => (
          <option key={strategy.customerCode} value={strategy.customerCode}>
            {strategy.displayName}
          </option>
        ))}
      </select>

      {selectedCustomer && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            Upload Requirements:
          </h4>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>
              • Formats:{" "}
              {selectedCustomer.instructions.acceptedFormats
                .join(", ")
                .toUpperCase()}
            </li>
            <li>
              • Max size:{" "}
              {Math.round(
                selectedCustomer.instructions.maxFileSize / (1024 * 1024)
              )}
              MB
            </li>
            <li>
              • Required columns:{" "}
              {selectedCustomer.instructions.requiredColumns.length}
            </li>
          </ul>

          {selectedCustomer.instructions.sampleData?.specialNotes && Array.isArray(selectedCustomer.instructions.sampleData.specialNotes) ? (
            <div className="mt-2 pt-2 border-t border-blue-200">
              <p className="text-xs font-medium text-blue-900 mb-1">
                Special Notes:
              </p>
              <ul className="text-xs text-blue-700 space-y-1">
                {(selectedCustomer.instructions.sampleData.specialNotes as string[]).map(
                  (note: string, index: number) => (
                    <li key={index}>• {note}</li>
                  )
                )}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
