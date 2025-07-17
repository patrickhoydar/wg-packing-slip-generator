# Customer Strategy Implementation Template

This template provides a standardized approach for documenting and implementing new customer strategies in the Wallace Graphics Packing Slip Generator.

## 1. Customer Overview

### Customer Information
- **Customer Name**: [Customer Name]
- **Customer Code**: [CUSTOMER_CODE] (uppercase, underscore-separated)
- **Display Name**: [Display Name for UI]
- **Contact Information**: [Primary contact details]
- **Implementation Priority**: [High/Medium/Low]

### Business Requirements
- **Order Volume**: [Expected monthly/yearly volume]
- **File Formats**: [CSV, XLSX, etc.]
- **Delivery Schedule**: [Frequency and timing]
- **Special Requirements**: [Any unique business rules]

## 2. Data Structure Analysis

### Input File Format(s)
#### Format 1: [Format Name]
- **File Type**: [CSV/XLSX/etc.]
- **Sample Structure**:
```
Column A | Column B | Column C | ...
---------|----------|----------|----
[Sample data structure]
```

#### Format 2: [Format Name] (if applicable)
- **File Type**: [CSV/XLSX/etc.]
- **Sample Structure**:
```
[Additional format if multiple file types]
```

### Required Columns
- **Shipping Information**:
  - `[Column Name]` - [Description]
  - `[Column Name]` - [Description]
- **Product Information**:
  - `[Column Name]` - [Description]
  - `[Column Name]` - [Description]
- **Additional Fields**:
  - `[Column Name]` - [Description]

### Optional Columns
- `[Column Name]` - [Description and default behavior]

## 3. Product Catalog

### Product Categories
- **Category 1**: [Description]
  - SKU Pattern: [Pattern]
  - Variations: [Language, grade level, etc.]
- **Category 2**: [Description]
  - SKU Pattern: [Pattern]
  - Variations: [Language, grade level, etc.]

### SKU Lookup Requirements
- **Lookup Table**: [Required Y/N]
- **Lookup Source**: [File/Database/API]
- **Mapping Logic**: [How SKUs map to descriptions]

## 4. Validation Rules

### Required Field Validation
- **Shipping Address**: [Validation rules]
- **Contact Information**: [Validation rules]
- **Product Quantities**: [Validation rules]
- **Delivery Requirements**: [Validation rules]

### Business Rule Validation
- **Minimum Order Requirements**: [Rules]
- **Geographic Restrictions**: [Rules]
- **Seasonal Restrictions**: [Rules]
- **Special Handling Requirements**: [Rules]

### Data Format Validation
- **Quantity Format**: [Expected format, e.g., "2, K" for qty 2, grade K]
- **Date Format**: [Expected format]
- **Address Format**: [Expected format]

## 5. Kit Generation Logic

### Kit Creation Rules
- **Kit Grouping**: [How rows are grouped into kits]
- **Item Aggregation**: [How items are combined]
- **Quantity Handling**: [How quantities are processed]

### Product Processing
- **SKU Generation**: [How SKUs are created/looked up]
- **Description Mapping**: [How product descriptions are generated]
- **Category Assignment**: [How products are categorized]

### Metadata Requirements
- **Order Reference**: [How order references are handled]
- **Tracking Information**: [What tracking data is captured]
- **Custom Fields**: [Any customer-specific fields]

## 6. Template Customization

### Branding Requirements
- **Company Name**: [Override rules]
- **Logo Requirements**: [Logo specifications]
- **Color Scheme**: [Brand colors]
- **Custom Styling**: [Any special styling requirements]

### Packing Slip Layout
- **Header Information**: [What appears in header]
- **Shipping Information**: [Shipping section requirements]
- **Product Table**: [Product display requirements]
- **Footer Information**: [Footer requirements]
- **Special Instructions**: [Where special instructions appear]

## 7. Shipping Rules

### Shipping Methods
- **Standard Shipping**: [Criteria and method]
- **Express Shipping**: [Criteria and method]
- **Special Handling**: [When special handling is required]

### Delivery Requirements
- **Dock Availability**: [How dock info is handled]
- **Delivery Windows**: [Time restrictions]
- **Appointment Requirements**: [When appointments are needed]
- **Contact Requirements**: [Required contact information]

### Special Instructions
- **Blind Shipping**: [If applicable]
- **Carrier Requirements**: [Specific carrier rules]
- **Packaging Requirements**: [Special packaging needs]

## 8. Implementation Checklist

### File Structure
- [ ] `backend/src/customers/strategies/[customer-folder]/`
- [ ] `[customer].strategy.ts` - Main strategy implementation
- [ ] `[customer].types.ts` - TypeScript interfaces
- [ ] `[customer].service.ts` - Additional services (if needed)
- [ ] `index.ts` - Export configuration

### Core Implementation
- [ ] Extend `CustomerStrategy` abstract class
- [ ] Implement `parseFile()` method
- [ ] Implement `validateData()` method
- [ ] Implement `generateKits()` method
- [ ] Implement `customizeTemplate()` method
- [ ] Implement `getShippingRules()` method
- [ ] Implement `getFileUploadInstructions()` method

### Testing
- [ ] Unit tests for strategy class
- [ ] Integration tests with sample data
- [ ] Validation rule tests
- [ ] Kit generation tests
- [ ] Template customization tests

### Documentation
- [ ] Customer-specific PRD
- [ ] Code documentation
- [ ] Sample data examples
- [ ] Error handling documentation

### Integration
- [ ] Register strategy in customer service
- [ ] Add to customer selection UI
- [ ] Update file upload validation
- [ ] Add to build process

## 9. Common Patterns

### CSV Parsing
Use the common CSV parsing service for standardized file processing:
```typescript
import { CsvParserService } from '../../../common/services/csv-parser.service';
```

### Error Handling
Follow established error handling patterns:
```typescript
// Validation errors
throw new Error(`Validation failed: ${validation.errors.join(', ')}`);

// Processing errors
console.error(`Error processing row ${index}:`, error);
```

### Utility Methods
Utilize base class utility methods:
```typescript
// String cleaning
this.cleanString(value)

// Number parsing
this.parseNumber(value)

// ID generation
this.generateKitId(customerCode, rowIndex, timestamp)
this.generateItemId(kitId, itemIndex)
```

## 10. Testing Strategy

### Test Data Requirements
- **Sample Input Files**: [List required sample files]
- **Expected Outputs**: [Define expected kit structures]
- **Edge Cases**: [List edge cases to test]

### Test Coverage
- **Unit Tests**: 90%+ coverage for strategy class
- **Integration Tests**: Full file processing pipeline
- **Validation Tests**: All validation rules
- **Error Handling Tests**: Exception scenarios

## 11. Deployment Considerations

### Environment Requirements
- **Development**: [Any dev-specific requirements]
- **Staging**: [Staging environment considerations]
- **Production**: [Production deployment notes]

### Performance Considerations
- **File Size Limits**: [Maximum file sizes]
- **Processing Time**: [Expected processing times]
- **Memory Usage**: [Memory considerations]

### Monitoring
- **Error Tracking**: [What errors to monitor]
- **Performance Metrics**: [Key performance indicators]
- **Business Metrics**: [Business success metrics]

---

## Implementation Notes

1. **Follow Existing Patterns**: Review Georgia Baptist and HH Global strategies for reference
2. **Code Reuse**: Utilize common services and utilities where possible
3. **Documentation**: Maintain comprehensive documentation throughout
4. **Testing**: Implement thorough testing at each stage
5. **Performance**: Consider performance implications for large files
6. **Error Handling**: Provide clear, actionable error messages
7. **Flexibility**: Design for future requirements and changes

This template should be customized for each new customer implementation while maintaining consistency across the codebase.