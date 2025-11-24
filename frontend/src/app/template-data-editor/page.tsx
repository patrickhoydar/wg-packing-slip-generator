"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FileText, Download, Eye, Code, FileCode } from "lucide-react"
import { parseHandlebarsVariables } from "@/lib/utils/handlebars-parser"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Available templates
const TEMPLATES = [
  {
    id: "scholastic",
    name: "Scholastic Template",
    path: "http://localhost:5001/templates/handlebars/scholastic",
  },
  {
    id: "inquired",
    name: "InquirED Template",
    path: "http://localhost:5001/templates/handlebars/inquired",
  },
  {
    id: "georgia-baptist",
    name: "Georgia Baptist Template",
    path: "http://localhost:5001/templates/handlebars/georgia-baptist",
  },
  {
    id: "default",
    name: "Default Template",
    path: "http://localhost:5001/templates/handlebars/default",
  },
  {
    id: "packing-slip",
    name: "Packing Slip Template",
    path: "http://localhost:5001/templates/handlebars/packing-slip",
  },
]

// Sample data structure for templates
const SAMPLE_DATA = {
  'scholastic': {
    shipTo: {
      company: 'Scholastic Inc.',
      address: '557 Broadway',
      city: 'New York',
      state: 'NY',
      zipCode: '10012'
    },
    boxTitle: 'Samples',
    boxNumber: '1',
    totalBoxes: '1',
    orderDetails: [
      {
        sku: 'ABC01',
        description: 'Take Home plus Cover Samples',
        quantity: '3'
      },
      {
        sku: 'DEF02',
        description: 'Take Home self Cover Samples',
        quantity: '3'
      },
      {
        sku: 'GHI03',
        description: 'Classroom (Gloss with UV plus Cover) Samples',
        quantity: '3'
      },
      {
        sku: 'JKL04',
        description: 'High Interest plus Cover Samples',
        quantity: '3'
      }
    ],
    studentDetails: [
      {
        description1: 'Take Home plus Cover Samples',
        code1: 'ABC01',
        studentName1: 'Thoe Tantipitham',
        description2: 'Classroom (Gloss with UV plus Cover) Samples',
        code2: 'GHI03',
        studentName2: 'Thoe Tantipitham'
      },
      {
        description1: 'Take Home plus Cover Samples',
        code1: 'ABC01',
        studentName1: 'Michael Shubel',
        description2: 'Classroom (Gloss with UV plus Cover) Samples',
        code2: 'GHI03',
        studentName2: 'Michael Shubel'
      },
      {
        description1: 'Take Home plus Cover Samples',
        code1: 'ABC01',
        studentName1: 'Kevin Spall',
        description2: 'Classroom (Gloss with UV plus Cover) Samples',
        code2: 'GHI03',
        studentName2: 'Kevin Spall'
      },
      {
        description1: 'Take Home self Cover Samples',
        code1: 'DEF02',
        studentName1: 'Thoe Tantipitham',
        description2: 'High Interest plus Cover Samples',
        code2: 'JKL04',
        studentName2: 'Thoe Tantipitham'
      },
      {
        description1: 'Take Home self Cover Samples',
        code1: 'DEF02',
        studentName1: 'Michael Shubel',
        description2: 'High Interest plus Cover Samples',
        code2: 'JKL04',
        studentName2: 'Michael Shubel'
      },
      {
        description1: 'Take Home self Cover Samples',
        code1: 'DEF02',
        studentName1: 'Kevin Spall',
        description2: 'High Interest plus Cover Samples',
        code2: 'JKL04',
        studentName2: 'Kevin Spall'
      }
    ]
  },
  'packing-slip': {
    logoImage: 'https://example.com/logo.png', // You can change this to any image URL
    showBarcode: true,
    barcodeImage: 'https://example.com/barcode.png',
    showJobInfo: true,
    jobNumber: 'JOB-2024-001',
    jrrNo: 'JRR-12345',
    showShipToDetails: true,
    shipTo: {
      school: 'Sample Elementary School',
      name: 'Jane Smith',
      address1: '123 Main Street',
      address2: 'Building A, Room 101',
      cityStateZip: 'Los Angeles, CA 90001',
      email: 'jane.smith@school.edu'
    },
    showShippingDetails: true,
    showAttention: true,
    attentionTeacher: 'ATTENTION: Ms. Johnson - Grade 3',
    showOrderDetails: true,
    orderDetails: [
      {
        sku: 'BK-001',
        description: 'Student Reading Book Set A',
        quantity: 25
      },
      {
        sku: 'WB-001',
        description: 'Student Workbook',
        quantity: 25
      },
      {
        sku: 'TE-001',
        description: 'Teacher Edition Guide',
        quantity: 1
      }
    ],
    backpacksOnly: false,
    showStudentDetails: true,
    studentDetails: [
      {
        description1: 'Reading Book',
        code1: 'RB-01',
        studentName1: 'John Doe',
        description2: 'Workbook',
        code2: 'WB-01',
        studentName2: 'Jane Smith'
      },
      {
        description1: 'Reading Book',
        code1: 'RB-02',
        studentName1: 'Mike Johnson',
        description2: 'Workbook',
        code2: 'WB-02',
        studentName2: 'Sarah Williams'
      }
    ],
    boxSize: 'Box Size: 18" x 12" x 10"'
  },
  inquired: {
    jobInfo: {
      jobNumber: "JOB-2024-001",
    },
    shipmentInfo: {
      erpShipmentId: "SHIP-12345",
    },
    metadata: {
      customFields: {
        boxNumber: "1",
        boxesInShipment: "3",
      },
    },
    shipTo: {
      company: "Sample School District",
      name: "John Doe",
      address: {
        street: "123 Education Lane",
        city: "Learning City",
        state: "CA",
        zipCode: "90210",
        country: "USA",
      },
      email: "john.doe@school.edu",
      phone: "(555) 123-4567",
    },
    deliveryInfo: {
      appointmentRequired: true,
      receivingDays: "Monday - Friday",
      receivingHours: "8:00 AM - 3:00 PM",
      shipDate: "2024-09-15",
      deliveryNotes: "Please call before delivery",
    },
    shippingMethod: "Ground",
    orderType: "te",
    items: [
      {
        customProperties: {
          productCategory: "Teacher Materials",
          gradeLevel: "Grade 3",
          needsSticker: true,
        },
        sku: "TM-GR3-001",
        description: "Teacher Edition - Mathematics Grade 3",
        quantity: 5,
      },
      {
        customProperties: {
          productCategory: "Student Materials",
          gradeLevel: "Grade 3",
          needsSticker: false,
        },
        sku: "SM-GR3-001",
        description: "Student Workbook - Mathematics Grade 3",
        quantity: 25,
      },
    ],
    summary: {
      totalQuantity: 30,
    },
    generatedDate: new Date().toLocaleDateString(),
  },
}

export default function TemplateDataEditor() {
  const [selectedTemplate, setSelectedTemplate] = useState<string>("scholastic")
  const [templateContent, setTemplateContent] = useState<string>("")
  const [templateData, setTemplateData] = useState<any>(SAMPLE_DATA.inquired)
  const [dataJson, setDataJson] = useState<string>(
    JSON.stringify(SAMPLE_DATA.inquired, null, 2)
  )
  const [variables, setVariables] = useState<string[]>([])
  const [previewHtml, setPreviewHtml] = useState<string>("")
  const [activeTab, setActiveTab] = useState<string>("form")

  // Load template content
  useEffect(() => {
    loadTemplate(selectedTemplate)
  }, [selectedTemplate])

  // Parse variables when template content changes
  useEffect(() => {
    if (templateContent) {
      const vars = parseHandlebarsVariables(templateContent)
      setVariables(vars)
    }
  }, [templateContent])

  const loadTemplate = async (templateId: string) => {
    try {
      const response = await fetch(
        `http://localhost:5001/templates/handlebars/${templateId}`
      )
      if (response.ok) {
        const content = await response.text()
        setTemplateContent(content)

        // Load sample data for this template if available
        const templateKey = templateId.replace(/-/g, '-') // Keep the hyphen for consistency
        if (SAMPLE_DATA[templateKey as keyof typeof SAMPLE_DATA]) {
          const sampleData = SAMPLE_DATA[templateKey as keyof typeof SAMPLE_DATA]
          setTemplateData(sampleData)
          setDataJson(JSON.stringify(sampleData, null, 2))
        } else {
          // If no sample data, create a basic structure
          const basicData = { logoImage: 'https://via.placeholder.com/200x80?text=Your+Logo' }
          setTemplateData(basicData)
          setDataJson(JSON.stringify(basicData, null, 2))
        }
      }
    } catch (error) {
      console.error("Failed to load template:", error)
      // Fallback: use a simple template for demonstration
      setTemplateContent(`
        <div>
          <h1>{{jobInfo.jobNumber}}</h1>
          <p>Ship to: {{shipTo.name}}</p>
          <p>Company: {{shipTo.company}}</p>
        </div>
      `)
    }
  }

  const updateNestedValue = (path: string, value: any) => {
    const keys = path.split(".")
    const newData = { ...templateData }
    let current = newData

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      if (!current[key]) {
        current[key] = {}
      }
      current = current[key]
    }

    current[keys[keys.length - 1]] = value
    setTemplateData(newData)
    setDataJson(JSON.stringify(newData, null, 2))
  }

  const getNestedValue = (path: string) => {
    const keys = path.split(".")
    let current = templateData

    for (const key of keys) {
      if (current && current[key] !== undefined) {
        current = current[key]
      } else {
        return ""
      }
    }

    return current
  }

  const handleJsonChange = (value: string) => {
    setDataJson(value)
    try {
      const parsed = JSON.parse(value)
      setTemplateData(parsed)
    } catch (error) {
      // Invalid JSON, don't update templateData
    }
  }

  const generatePreview = async () => {
    try {
      const response = await fetch("http://localhost:5001/templates/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          template: templateContent,
          data: templateData,
          templateName: selectedTemplate,
        }),
      })

      if (response.ok) {
        const html = await response.text()
        setPreviewHtml(html)
      }
    } catch (error) {
      console.error("Failed to generate preview:", error)
    }
  }

  const exportData = () => {
    const blob = new Blob([dataJson], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `template-data-${selectedTemplate}.json`
    a.click()
  }

  const downloadPDF = async () => {
    try {
      // Map template names to customer strategies
      const strategyMap: Record<string, string> = {
        'scholastic': 'scholastic',
        'inquired': 'INQUIRED',
        'georgia-baptist': 'georgia-baptist',
        'packing-slip': 'default',
        'default': 'default'
      }
      
      const customerStrategy = strategyMap[selectedTemplate] || 'default'
      
      const response = await fetch(
        `http://localhost:5001/pdf/generate-packing-slip?customerStrategy=${customerStrategy}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(templateData),
        }
      )

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${selectedTemplate}-packing-slip.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        console.error('Failed to generate PDF')
        alert('Failed to generate PDF. Please check the console for errors.')
      }
    } catch (error) {
      console.error('Error downloading PDF:', error)
      alert('Error downloading PDF. Please check the console for details.')
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Template Data Editor</h1>
            <p className="text-muted-foreground mt-2">
              Load Handlebars templates and edit their data
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={generatePreview} variant="outline">
              <Eye className="w-4 h-4 mr-2" />
              Preview HTML
            </Button>
            <Button onClick={downloadPDF} variant="default">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button onClick={exportData} variant="outline">
              <FileCode className="w-4 h-4 mr-2" />
              Export JSON
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Template Selection and Data Editing */}
          <div className="space-y-6">
            <Card className="p-6">
              <Label htmlFor="template-select">Select Template</Label>
              <Select
                value={selectedTemplate}
                onValueChange={setSelectedTemplate}
              >
                <SelectTrigger id="template-select" className="mt-2">
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATES.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        {template.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Card>

            <Card className="p-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="form">Form Editor</TabsTrigger>
                  <TabsTrigger value="json">JSON Editor</TabsTrigger>
                </TabsList>

                <TabsContent value="form" className="space-y-4 mt-4">
                  <h3 className="text-lg font-semibold">Template Variables</h3>
                  <div className="max-h-[600px] overflow-y-auto space-y-4">
                    {variables.map((variable, index) => {
                      const cleanVar = variable.replace(/[{}]/g, "")
                      const value = getNestedValue(cleanVar)

                      return (
                        <div key={index}>
                          <Label htmlFor={`var-${index}`}>
                            {variable}
                            {(cleanVar.includes('Image') || cleanVar.includes('logo') || cleanVar.includes('barcode')) && 
                              <span className="text-xs text-muted-foreground ml-2">(Image URL)</span>
                            }
                          </Label>
                          {typeof value === "boolean" ? (
                            <Select
                              value={value.toString()}
                              onValueChange={(val) =>
                                updateNestedValue(cleanVar, val === "true")
                              }
                            >
                              <SelectTrigger
                                id={`var-${index}`}
                                className="mt-1"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="true">True</SelectItem>
                                <SelectItem value="false">False</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="space-y-2">
                              <Input
                                id={`var-${index}`}
                                value={value}
                                onChange={(e) =>
                                  updateNestedValue(cleanVar, e.target.value)
                                }
                                className="mt-1"
                                placeholder={
                                  (cleanVar.includes('Image') || cleanVar.includes('logo') || cleanVar.includes('barcode'))
                                    ? 'Enter image URL (e.g., https://example.com/image.png)'
                                    : `Enter value for ${variable}`
                                }
                              />
                              {(cleanVar.includes('Image') || cleanVar.includes('logo') || cleanVar.includes('barcode')) && value && (
                                <div className="mt-2">
                                  <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                                  <img 
                                    src={value as string} 
                                    alt="Preview" 
                                    className="max-w-[200px] max-h-[100px] object-contain border rounded"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </TabsContent>

                <TabsContent value="json" className="mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="json-editor">JSON Data</Label>
                    <Textarea
                      id="json-editor"
                      value={dataJson}
                      onChange={(e) => handleJsonChange(e.target.value)}
                      className="font-mono text-sm h-[600px]"
                      placeholder="Enter JSON data..."
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </div>

          {/* Right Panel - Template and Preview */}
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Template Code</h3>
                <Code className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="bg-muted rounded-lg p-4 max-h-[300px] overflow-auto">
                <pre className="text-xs font-mono whitespace-pre-wrap">
                  {templateContent || "Loading template..."}
                </pre>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Preview</h3>
                <Eye className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="border rounded-lg p-4 min-h-[400px] bg-white">
                {previewHtml ? (
                  <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    Click "Preview" to see the rendered template
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
