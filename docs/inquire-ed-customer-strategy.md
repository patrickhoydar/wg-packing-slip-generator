# InquireEd Customer Strategy Implementation

## 1. Customer Overview

### Customer Information
- **Customer Name**: InquireEd
- **Customer Code**: INQUIRE_ED
- **Display Name**: InquireEd
- **Contact Information**: Educational materials publisher
- **Implementation Priority**: High

### Business Requirements
- **Order Volume**: Medium to high volume educational material orders
- **File Formats**: CSV (two distinct formats)
- **Delivery Schedule**: Seasonal delivery with earliest delivery date requirements
- **Special Requirements**: 
  - Educational materials for K-5 grades
  - English and Spanish language variants
  - Teacher editions with sticker requirements
  - Complex shipping requirements with dock/appointment scheduling

## 2. Data Structure Analysis

### Input File Format(s)
#### Format 1: PM Orders (Printed Materials)
- **File Type**: CSV
- **Sample Structure**:
```
District or School | Dock? | Paved Path? | Receiving Days | Receiving Hours | Delivery Address | Shipping Contact Name | Shipping Contact Email | Shipping Contact Phone | Delivery Notes | Total Number of Boxes Ordered | IND-IJ-PM-NAVIG-EN-0100 | IND-IJ-PM-NAVIG-SP-0100 | ... | Fall 2025 Earliest Delivery Date | Appointment Required?
```

#### Format 2: TE Orders (Teacher Editions)
- **File Type**: CSV
- **Sample Structure**:
```
District or School | Dock? | Paved Path? | Receiving Days | Receiving Hours | Delivery Address | Shipping Contact Name | Shipping Contact Email | Shipping Contact Phone | Total Number of TEs Ordered | IND-IJ-TE-NAVIG-0100 | IND-IJ-TE-MYTEAM-0200 | ... | Fall 2025 Earliest Delivery Date | Appointment Required?
```

### Required Columns
- **Shipping Information**:
  - `District or School` - School/district name
  - `Delivery Address` - Complete shipping address
  - `Shipping Contact Name` - Primary contact person
  - `Shipping Contact Email` - Contact email
  - `Shipping Contact Phone` - Contact phone number
- **Product Information**:
  - `IND-IJ-PM-*` columns (PM Orders) - Product quantities with grade info
  - `IND-IJ-TE-*` columns (TE Orders) - Teacher edition quantities with sticker info
- **Delivery Requirements**:
  - `Fall 2025 Earliest Delivery Date` - Earliest acceptable delivery date
  - `Appointment Required?` - Whether appointment is needed

### Optional Columns
- `Dock?` - Whether loading dock is available (defaults to "No")
- `Paved Path?` - Whether paved path access exists (defaults to "No")
- `Receiving Days` - Days of week for receiving (defaults to "M-F")
- `Receiving Hours` - Hours for receiving (defaults to business hours)
- `Delivery Notes` - Special delivery instructions
- `Total Number of Boxes Ordered` / `Total Number of TEs Ordered` - Total count

## 3. Product Catalog

### Product Categories
- **Printed Materials (English)**: Student materials in English
  - SKU Pattern: `IND-IJ-PM-*-EN-*`
  - Variations: 19 different topics, grades K-5
- **Printed Materials (Spanish)**: Student materials in Spanish
  - SKU Pattern: `IND-IJ-PM-*-SP-*`
  - Variations: 19 different topics, grades K-5
- **Printed Teacher Editions**: Teacher resources (language-neutral)
  - SKU Pattern: `IND-IJ-TE-*-*`
  - Variations: 19 different topics

### SKU Lookup Requirements
- **Lookup Table**: Required
- **Lookup Source**: `Packing Slip Look Up Table.csv`
- **Mapping Logic**: 
  - SKU → Full product description
  - Category classification (Printed Materials vs Teacher Editions)
  - Language variant identification

## 4. Validation Rules

### Required Field Validation
- **Shipping Address**: Must have valid `Delivery Address`
- **Contact Information**: Must have `Shipping Contact Name` and `Shipping Contact Email`
- **Product Quantities**: At least one product column must have valid quantity
- **Delivery Requirements**: Must have valid `Fall 2025 Earliest Delivery Date`

### Business Rule Validation
- **Minimum Order Requirements**: At least one product with quantity > 0
- **Geographic Restrictions**: None specified
- **Seasonal Restrictions**: Must respect earliest delivery date
- **Special Handling Requirements**: Teacher editions with sticker requirements

### Data Format Validation
- **Quantity Format**: 
  - PM Orders: `"2, K"` format (quantity 2, grade K)
  - TE Orders: `"30, No Sticker"` or `"28, Needs Sticker: K"` format
- **Date Format**: Various formats accepted for delivery dates
- **Address Format**: Multi-line addresses in single field

## 5. Kit Generation Logic

### Kit Creation Rules
- **Kit Grouping**: Each row = one kit (one delivery to one school/district)
- **Item Aggregation**: Sum quantities by SKU within each kit
- **Quantity Handling**: Parse special quantity formats and extract grade/sticker info

### Product Processing
- **SKU Generation**: Direct mapping from column headers to SKU lookup table
- **Description Mapping**: Use lookup table to get full product descriptions
- **Category Assignment**: Based on SKU pattern (PM vs TE)

### Metadata Requirements
- **Order Reference**: School/district name as reference
- **Tracking Information**: Delivery date, appointment requirement, dock availability
- **Custom Fields**: Sticker requirements, grade levels, delivery notes

## 6. Template Customization

### Branding Requirements
- **Company Name**: InquireEd (override default)
- **Logo Requirements**: Standard InquireEd branding
- **Color Scheme**: Educational theme colors
- **Custom Styling**: Clean, professional educational layout

### Packing Slip Layout
- **Header Information**: 
  - InquireEd company name
  - Shipped from Wallace Graphics address
  - Earliest delivery date
- **Shipping Information**: 
  - School/district name
  - Complete delivery address
  - Contact person and phone/email
  - Delivery notes and special instructions
- **Product Table**: 
  - Product category grouping
  - SKU, description, quantity
  - Grade level information
  - Sticker requirements (for TE)
- **Footer Information**: 
  - Appointment requirement notice
  - Dock availability information
  - Special handling instructions

## 7. Shipping Rules

### Shipping Methods
- **Standard Shipping**: Default method for most orders
- **Express Shipping**: When earliest delivery date is urgent
- **Special Handling**: Required for teacher editions with sticker requirements

### Delivery Requirements
- **Dock Availability**: Track dock access and route delivery accordingly
- **Delivery Windows**: Respect receiving days and hours
- **Appointment Requirements**: Schedule appointments when required
- **Contact Requirements**: Ensure contact person is available

### Special Instructions
- **Blind Shipping**: Not applicable
- **Carrier Requirements**: Standard educational delivery
- **Packaging Requirements**: Protect materials during transport

## 8. Implementation Checklist

### File Structure
- [x] `backend/src/customers/strategies/inquire-ed/`
- [ ] `inquire-ed.strategy.ts` - Main strategy implementation
- [ ] `inquire-ed.types.ts` - TypeScript interfaces
- [ ] `inquire-ed.service.ts` - SKU lookup service
- [ ] `index.ts` - Export configuration

### Core Implementation
- [ ] Extend `CustomerStrategy` abstract class
- [ ] Implement `parseFile()` method - Handle PM and TE CSV formats
- [ ] Implement `validateData()` method - Validate required fields and formats
- [ ] Implement `generateKits()` method - Create kits with proper product parsing
- [ ] Implement `customizeTemplate()` method - InquireEd branding and layout
- [ ] Implement `getShippingRules()` method - Handle delivery requirements
- [ ] Implement `getFileUploadInstructions()` method - Guide for file uploads

### Testing
- [ ] Unit tests for strategy class
- [ ] Integration tests with sample data (PM and TE files)
- [ ] Validation rule tests
- [ ] Kit generation tests with quantity parsing
- [ ] Template customization tests
- [ ] SKU lookup service tests

### Documentation
- [x] Customer-specific PRD (this document)
- [ ] Code documentation
- [ ] Sample data examples
- [ ] Error handling documentation

### Integration
- [ ] Register strategy in customer service
- [ ] Add to customer selection UI
- [ ] Update file upload validation
- [ ] Add to build process

## 9. Special Processing Requirements

### Quantity Format Parsing
- **PM Orders**: Parse `"2, K"` format to extract:
  - Quantity: `2`
  - Grade Level: `K`
- **TE Orders**: Parse `"30, No Sticker"` or `"28, Needs Sticker: K"` format to extract:
  - Quantity: `30` or `28`
  - Sticker Requirement: `true/false`
  - Grade Level: `K` (when sticker needed)

### File Type Detection
- **PM Orders**: Presence of `IND-IJ-PM-*` columns
- **TE Orders**: Presence of `IND-IJ-TE-*` columns
- **Validation**: Ensure file contains only one type

### SKU Lookup Integration
- **Load Lookup Table**: Parse `Packing Slip Look Up Table.csv` on startup
- **SKU Mapping**: Map column headers to SKU codes
- **Description Retrieval**: Get full product descriptions
- **Category Assignment**: Classify as PM or TE based on SKU pattern

### Address Processing
- **Multi-line Addresses**: Handle addresses with embedded newlines
- **Address Parsing**: Extract street, city, state, zip from combined field
- **Validation**: Ensure address components are complete

## 10. Testing Strategy

### Test Data Requirements
- **Sample Input Files**: 
  - `PM Orders_ Ready for Wallace (3).csv`
  - `TE Orders_ Ready for Wallace (4).csv`
  - `Packing Slip Look Up Table.csv`
- **Expected Outputs**: 
  - Kits with proper product parsing
  - Correct quantity and grade level extraction
  - Proper sticker requirement handling
- **Edge Cases**: 
  - Empty quantity fields
  - Invalid date formats
  - Missing contact information
  - Malformed quantity strings

### Test Coverage
- **Unit Tests**: 90%+ coverage for strategy class
- **Integration Tests**: Full file processing pipeline for both PM and TE
- **Validation Tests**: All validation rules including quantity format validation
- **Error Handling Tests**: Invalid file formats, missing required fields

## 11. Deployment Considerations

### Environment Requirements
- **Development**: Access to sample data files
- **Staging**: Full SKU lookup table integration
- **Production**: Performance optimization for large school district orders

### Performance Considerations
- **File Size Limits**: Support for large district orders (500+ schools)
- **Processing Time**: Efficient SKU lookup and quantity parsing
- **Memory Usage**: Optimize for large CSV files

### Monitoring
- **Error Tracking**: Quantity parsing errors, SKU lookup failures
- **Performance Metrics**: File processing time, kit generation speed
- **Business Metrics**: Order completion rates, delivery date compliance

---

## Implementation Notes

1. **Quantity Parsing**: Critical feature - ensure robust parsing of the special quantity formats
2. **File Type Detection**: Automatic detection of PM vs TE files based on column headers
3. **SKU Lookup**: Efficient lookup service with proper error handling
4. **Address Handling**: Careful parsing of multi-line addresses
5. **Delivery Requirements**: Proper handling of appointment and dock requirements
6. **Grade Level Tracking**: Maintain grade level information throughout processing
7. **Sticker Requirements**: Special handling for teacher edition sticker requirements

This implementation will provide comprehensive support for InquireEd's educational material distribution requirements while maintaining the flexibility to handle their unique data formats and business rules.