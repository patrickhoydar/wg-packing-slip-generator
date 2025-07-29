# PACE Integration Examples for InquirED

## Overview
This document provides examples of how to use the PACE integration endpoints for creating shipments from InquirED kits.

## API Endpoints

### 1. Create Single PACE Shipment
**Endpoint:** `POST /customers/INQUIRED/pace/create-shipment`

**Request Body:**
```json
{
  "kit": {
    "id": "INQUIRED-20250724-0000",
    "customerCode": "INQUIRED",
    "recipient": {
      "name": "Marie",
      "company": "Detroit Public Schools, MI",
      "address": {
        "street": "Vedo Outsourcing",
        "street2": "2201 Fenkell Ave",
        "city": "Detroit MI 48238"
      }
    },
    "items": [
      {
        "sku": "IND-IJ-PM-NATRES-EN-1300",
        "quantity": 188
      }
    ],
    "metadata": {
      "customFields": {
        "deliveryInfo": {
          "hasDock": true,
          "hasPavedPath": true,
          "receivingHours": "8:30 - 5",
          "shipDate": "8/7/2025"
        },
        "totalBoxes": 564
      }
    }
  },
  "jobNumber": "206929"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Shipment created successfully",
  "shipmentId": "12345",
  "errors": null
}
```

### 2. Create Batch PACE Shipments
**Endpoint:** `POST /customers/INQUIRED/pace/create-batch-shipments`

**Request Body:**
```json
{
  "kits": [
    {
      "id": "INQUIRED-20250724-0001",
      "customerCode": "INQUIRED",
      "recipient": { /* kit data */ },
      "items": [ /* items array */ ],
      "metadata": { /* metadata object */ }
    },
    {
      "id": "INQUIRED-20250724-0002",
      "customerCode": "INQUIRED",
      "recipient": { /* kit data */ },
      "items": [ /* items array */ ],
      "metadata": { /* metadata object */ }
    }
  ],
  "jobNumber": "206929"
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "kitId": "INQUIRED-20250724-0001",
      "result": {
        "success": true,
        "message": "Shipment created successfully",
        "shipmentId": "12345"
      }
    },
    {
      "kitId": "INQUIRED-20250724-0002",
      "result": {
        "success": true,
        "message": "Shipment created successfully",
        "shipmentId": "12346"
      }
    }
  ],
  "summary": {
    "total": 2,
    "successful": 2,
    "failed": 0
  }
}
```

## Data Transformation

The following transformations are applied when converting InquirED kit data to PACE format:

### Address Parsing
- **Combined City/State/Zip**: "Detroit MI 48238" → city: "Detroit", state: "MI", zip: "48238"
- **State Key Format**: "MI" → "1:MI" (PACE format)

### Contact Information
- **Kit recipient.name** → **PACE contactFirstName**
- **Kit recipient.company** → **PACE contactLastName**

### Shipping Method
- **Orders < 10 boxes**: UPS Ground (shipVia: 1)
- **Orders ≥ 10 boxes**: Based on dock/paved path logic

### Internal Notes
Automatically generated from delivery information:
- Appointment requirements
- Dock availability
- Paved path status
- Receiving hours and days
- Special delivery notes

### Weight Estimation
- **Formula**: totalBoxes × 10 lbs (rough estimate for educational materials)
- **Note**: Should be refined with actual product weight data

## Error Handling

### Common Errors
1. **Invalid Customer Code**: Only "INQUIRED" is currently supported
2. **Missing Required Fields**: kit data and jobNumber are required
3. **PACE API Errors**: Network issues, authentication failures, etc.

### Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "errors": ["Detailed error message 1", "Detailed error message 2"]
}
```

## Integration Notes

1. **Job Number Format**: For batch operations, job numbers are auto-generated as `{prefix}-001`, `{prefix}-002`, etc.
2. **Async Processing**: Each shipment is created sequentially to avoid API rate limits
3. **Fallback Logic**: If transformation fails, detailed error messages are provided
4. **Validation**: Input data is validated before sending to PACE API