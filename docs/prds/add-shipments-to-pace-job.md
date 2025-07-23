# Add Shipments to PACE Job

## Requirement
Add a shipment in PACE for each order that is shipped through SiteFlow.

## Approach
SiteFlow sends postbacks to `siteflow-webhook.controller.ts` when an order is marked as shipped. At this point, we should:
- Save shipment information to our database
- Make a PACE API call to `/CreateObject/createJobShipment` to create the shipment record

## PACE API Endpoint
**POST** `/CreateObject/createJobShipment`

## Sample Payload
```json
{
  "job": "GOVD-0000080",
  "shipmentType": 50,
  "shipVia": 1,
  "quantity": 1,
  "contactLastName": "GovDocs",
  "contactFirstName": "Testing",
  "address1": "10228 BROADWAY ST STE 140",
  "address2": "",
  "zip": "20546-0002",
  "city": "PEARLAND",
  "country": 1,
  "stateKey": "1:TX",
  "dateTime": "2025-07-21T13:51:17",
  "cost": 10.44,
  "charges": "Prepaid/Shipper",
  "weight": 10,
  "shipped": true,
  "trackingNumber": "1Z6926XX0394919166",
  "carton1Count": 1,
  "count1": 1,
  "carton1Quantity": 1,
  "u_internalShipNotes": "Shipment from Siteflow",
  "accountNumber": "string",
  "forcedAccountNumber": true
}
```

## Field Mapping Notes

| JSON Field            | Required | Description                                                                    | Mapped To (PACE Schema)                |
| --------------------- | -------- | ------------------------------------------------------------------------------ | -------------------------------------- |
| `job`                 | ✅        | PACE job ID (kit.job_number)                                                   | `ccmasterid` (from `job` table)        |
| `shipmentType`        | ✅        | Type of shipment (e.g., 50 = standard outbound)                                | `ccshipmenttype`                       |
| `shipVia`             | ✅        | ShipVia method ID (based on shipment.carrier_alias & shipment.carrier_service) | `shipvia`                              |
| `quantity`            | ✅        | Total items shipped (1 for all shipments)                                      | `ccquantity1`, `carton1Quantity`, etc. |
| `contactFirstName`    | ✅        | Ship-to contact first name (shipment.address_to->>'name')                      | `contactfirstname`                     |
| `contactLastName`     | ✅        | Ship-to contact last name (GovDocs - hardcoded)                                | `contactlastname`                      |
| `address1`            | ✅        | Street address (shipment.address_to->>address1)                                | `ccaddress1`                           |
| `address2`            | ❌        | Address line 2 (shipment.address_to->>address2)                                | `ccaddress2`                           |
| `zip`                 | ✅        | Postal code (sh.address_to->>'postalCode')                                     | `cczip`                                |
| `city`                | ✅        | City (sh.address_to->>'city')                                                  | `cccity`                               |
| `country`             | ✅        | Country ID (sh.address_to->>'country') - lookup based on Country               | `country`                              |
| `stateKey`            | ✅        | State in format "1:XX" (sh.address_to->>'state')                               | `systateid` (parsed from `stateKey`)   |
| `dateTime`            | ✅        | Shipment datetime (shipment.ship_date)                                         | `ccdate` and `cctime`                  |
| `cost`                | ✅        | Shipping cost (shipment.published_cost)                                        | `cccost`                               |
| `charges`             | ✅        | Billing method ("Prepaid/Shipper")                                             | `charges`                              |
| `weight`              | ✅        | Total weight (sh.source_data->'packages'->0->>'totalWeight')                   | `ccweight` or `weightounces`           |
| `shipped`             | ✅        | Flag for shipment status ("shipped")                                           | `shipped`                              |
| `trackingNumber`      | ✅        | Shipment tracking number (shipment.trackingNumber)                             | `cctrackingnumber`                     |
| `carton1Count`        | ✅        | Number of cartons (1)                                                          | `cccount1`                             |
| `count1`              | ✅        | Alias of carton count (used in downstream logic) (1)                           | `cccount1`                             |
| `carton1Quantity`     | ✅        | Quantity in the carton (1)                                                     | `ccquantity1`                          |
| `u_internalShipNotes` | ✅        | Internal notes on shipment (set to "Shipment from Siteflow")                   | `ccnotes` or custom field mapping      |
| `accountNumber`       | ❌        | Optional account number override. Use when shipment 3rd party                  | `accountnumber`                        |
| `forcedAccountNumber` | ❌        | Whether to force the account number                                            | `forcedaccountnumber`                  |

## Shipment PACE ID lookup
| Code | Carrier | Service               |
| ---- | ------- | --------------------- |
| 1    | UPS     | Ground                |
| 5010 | FedEx   | Ground                |
| 5046 | FedEx   | International Economy |
| 5017 | USPS    | Ground Advantage      |
| 5056 | USPS    | Express               |
| 5096 | USPS    | Priority              |
| 5098 | USPS    | First Class Flat      |
****
## Additional Notes
- Consider adding error handling/logging for failed PACE API responses.
