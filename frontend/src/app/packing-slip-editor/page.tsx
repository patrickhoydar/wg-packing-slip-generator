"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Download, Save, Printer } from "lucide-react";

interface OrderItem {
  id: string;
  description: string;
  quantity: number;
}

interface PackingSlipData {
  companyAddress: string;
  companyPhone: string;
  jobNumber: string;
  customerName: string;
  shipTo: {
    name: string;
    address: string;
    city: string;
    country: string;
    email: string;
    phone: string;
  };
  orderItems: OrderItem[];
  generatedDate: string;
}

export default function PackingSlipEditor() {
  const [data, setData] = useState<PackingSlipData>({
    companyAddress: "2450 Meadowbrook Pkwy Duluth, GA 30096",
    companyPhone: "Phone: 877-415-7323",
    jobNumber: "205544 - HH Global",
    customerName: "HH Global",
    shipTo: {
      name: "John Smith",
      address: "789 Pine Avenue",
      city: "Springfield, IL 62702",
      country: "US",
      email: "john.smith@example.com",
      phone: "(555) 987-6543",
    },
    orderItems: [
      { id: "1", description: "Premium business cards, 16pt cardstock, matte finish", quantity: 1000 },
      { id: "2", description: "Full-color flyers, 100lb text paper, UV coating", quantity: 500 },
      { id: "3", description: "3ft x 6ft vinyl banner with grommets", quantity: 2 },
    ],
    generatedDate: new Date().toLocaleDateString("en-US", { 
      year: "numeric", 
      month: "long", 
      day: "numeric" 
    }),
  });

  const [isEditing, setIsEditing] = useState(true);

  const updateField = (path: string, value: any) => {
    setData((prev) => {
      const newData = { ...prev };
      const keys = path.split(".");
      let current: any = newData;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  const addOrderItem = () => {
    const newItem: OrderItem = {
      id: Date.now().toString(),
      description: "New item description",
      quantity: 1,
    };
    setData((prev) => ({
      ...prev,
      orderItems: [...prev.orderItems, newItem],
    }));
  };

  const removeOrderItem = (id: string) => {
    setData((prev) => ({
      ...prev,
      orderItems: prev.orderItems.filter((item) => item.id !== id),
    }));
  };

  const updateOrderItem = (id: string, field: keyof OrderItem, value: any) => {
    setData((prev) => ({
      ...prev,
      orderItems: prev.orderItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
  };

  const totalItems = data.orderItems.length;
  const totalQuantity = data.orderItems.reduce((sum, item) => sum + item.quantity, 0);

  const handlePrint = () => {
    window.print();
  };

  const handleSave = async () => {
    // Save to backend
    console.log("Saving packing slip:", data);
    alert("Packing slip saved!");
  };

  const handleGeneratePDF = async () => {
    try {
      const response = await fetch("http://localhost:5001/pdf/generate-packing-slip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order: {
            orderNumber: data.jobNumber,
            date: data.generatedDate,
          },
          customer: {
            name: data.shipTo.name,
            company: data.customerName,
            address: `${data.shipTo.address}, ${data.shipTo.city}`,
            email: data.shipTo.email,
            phone: data.shipTo.phone,
          },
          items: data.orderItems.map((item, index) => ({
            id: index + 1,
            description: item.description,
            quantity: item.quantity,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `packing-slip-${data.jobNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Toolbar */}
      <div className="no-print bg-white border-b sticky top-0 z-10 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-semibold">Packing Slip Editor</h1>
          <div className="flex items-center gap-2">
            <Button
              variant={isEditing ? "default" : "outline"}
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? "Preview" : "Edit"}
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button size="sm" onClick={handleGeneratePDF}>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Packing Slip */}
      <div className="max-w-5xl mx-auto p-8 print:p-0">
        <Card className="bg-white shadow-lg print:shadow-none">
          <div className="p-8 print:p-12">
            {/* Header */}
            <div className="flex justify-between items-start mb-8">
              <div>
                {isEditing ? (
                  <>
                    <Input
                      value={data.companyAddress}
                      onChange={(e) => updateField("companyAddress", e.target.value)}
                      className="mb-2 border-dashed"
                    />
                    <Input
                      value={data.companyPhone}
                      onChange={(e) => updateField("companyPhone", e.target.value)}
                      className="border-dashed"
                    />
                  </>
                ) : (
                  <>
                    <p className="text-sm">{data.companyAddress}</p>
                    <p className="text-sm">{data.companyPhone}</p>
                  </>
                )}
              </div>
              <h1 className="text-3xl font-bold">PACKING LIST</h1>
            </div>

            <hr className="mb-6" />

            {/* Job Number */}
            <div className="mb-6">
              <span className="text-sm font-medium">Job No: </span>
              {isEditing ? (
                <Input
                  value={data.jobNumber}
                  onChange={(e) => updateField("jobNumber", e.target.value)}
                  className="inline-block w-64 ml-2 border-dashed"
                />
              ) : (
                <span className="text-sm">{data.jobNumber}</span>
              )}
            </div>

            {/* Ship To */}
            <div className="mb-6">
              <h2 className="font-bold mb-3">Ship To:</h2>
              <div className="border border-gray-300 rounded p-4">
                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      value={data.shipTo.name}
                      onChange={(e) => updateField("shipTo.name", e.target.value)}
                      placeholder="Name"
                      className="border-dashed"
                    />
                    <Input
                      value={data.shipTo.address}
                      onChange={(e) => updateField("shipTo.address", e.target.value)}
                      placeholder="Address"
                      className="border-dashed"
                    />
                    <Input
                      value={data.shipTo.city}
                      onChange={(e) => updateField("shipTo.city", e.target.value)}
                      placeholder="City, State ZIP"
                      className="border-dashed"
                    />
                    <Input
                      value={data.shipTo.country}
                      onChange={(e) => updateField("shipTo.country", e.target.value)}
                      placeholder="Country"
                      className="border-dashed"
                    />
                    <Input
                      value={data.shipTo.email}
                      onChange={(e) => updateField("shipTo.email", e.target.value)}
                      placeholder="Email"
                      className="border-dashed"
                    />
                    <Input
                      value={data.shipTo.phone}
                      onChange={(e) => updateField("shipTo.phone", e.target.value)}
                      placeholder="Phone"
                      className="border-dashed"
                    />
                  </div>
                ) : (
                  <>
                    <p>{data.shipTo.name}</p>
                    <p>{data.shipTo.address}</p>
                    <p>{data.shipTo.city}</p>
                    <p>{data.shipTo.country}</p>
                    <p>{data.shipTo.email}</p>
                    <p>{data.shipTo.phone}</p>
                  </>
                )}
              </div>
            </div>

            {/* Order Details */}
            <div className="mb-6">
              <h2 className="font-bold mb-3">ORDER DETAILS</h2>
              <div className="border border-gray-300 rounded overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3 border-b">Description</th>
                      <th className="text-right p-3 border-b">Qty Ordered</th>
                      {isEditing && (
                        <th className="text-center p-3 border-b no-print">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.orderItems.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="p-3">
                          {isEditing ? (
                            <Input
                              value={item.description}
                              onChange={(e) =>
                                updateOrderItem(item.id, "description", e.target.value)
                              }
                              className="border-dashed"
                            />
                          ) : (
                            item.description
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {isEditing ? (
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) =>
                                updateOrderItem(item.id, "quantity", parseInt(e.target.value) || 0)
                              }
                              className="border-dashed text-right"
                            />
                          ) : (
                            item.quantity.toLocaleString()
                          )}
                        </td>
                        {isEditing && (
                          <td className="p-3 text-center no-print">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeOrderItem(item.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {isEditing && (
                  <div className="p-3 bg-gray-50 no-print">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addOrderItem}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Item
                    </Button>
                  </div>
                )}
              </div>
              
              {/* Totals */}
              <div className="mt-4 space-y-1">
                <p className="text-sm">
                  <span className="font-medium">Total Items:</span> {totalItems}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Total Quantity:</span> {totalQuantity.toLocaleString()}
                </p>
              </div>
            </div>

            <hr className="my-6" />

            {/* Footer */}
            <div className="flex justify-between items-end text-sm text-gray-600">
              <div>
                <p>Generated on: {data.generatedDate}</p>
                <p>Job Number: {data.jobNumber}</p>
              </div>
              <p className="text-right">Please verify all items before shipping</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          
          body {
            background: white !important;
          }
          
          .print\\:p-12 {
            padding: 3rem !important;
          }
          
          .print\\:shadow-none {
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}