# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a comprehensive packing slip generator application for Wallace Graphics that processes customer order files and generates customized packing slips. The system uses a **strategy pattern** architecture to support multiple customers with unique requirements through a drag-and-drop template editor.

**Key Capabilities:**
- Multi-customer support with extensible strategy pattern
- CSV/Excel file processing with validation
- PDF generation using Puppeteer + Handlebars templates
- Batch processing with concurrency control
- Drag-and-drop template editor
- Database integration with Prisma + PostgreSQL

## Development Commands

### Initial Setup
```bash
# Install all dependencies (root + frontend + backend)
npm run install:all

# Setup database (if using Prisma)
cd backend && npx prisma migrate dev
cd backend && npx prisma generate
```

### Development
```bash
# Start both frontend and backend concurrently
npm run dev

# Start individually
npm run dev:frontend   # Frontend: http://localhost:3000
npm run dev:backend    # Backend: http://localhost:3001

# Database operations
cd backend && npx prisma studio              # Database GUI
cd backend && npx prisma migrate dev         # Run migrations
cd backend && npx prisma db seed            # Seed database
```

### Building & Testing
```bash
# Build both applications
npm run build

# Run tests
npm run test                    # All tests
npm run test:backend           # Backend only
cd backend && npm run test:e2e # End-to-end tests
cd backend && npm run test:cov # Coverage report

# Linting & Type Checking
npm run lint                   # All linting
npm run type-check            # TypeScript validation
cd backend && npm run format  # Prettier formatting
```

### Individual App Commands
```bash
# Backend specific
cd backend && npm run start:dev     # Development mode
cd backend && npm run start:debug   # Debug mode
cd backend && npm run start:prod    # Production mode

# Frontend specific  
cd frontend && npm run dev           # Development server
cd frontend && npm run build        # Production build
cd frontend && npm run start        # Production server
```

## Architecture Overview

### High-Level Architecture
- **Monorepo Structure**: Root workspace with frontend/ and backend/ applications
- **Frontend**: Next.js 15 with TypeScript, Tailwind CSS, drag-and-drop editing
- **Backend**: NestJS with TypeScript, Puppeteer PDF generation, Prisma ORM
- **Database**: PostgreSQL with comprehensive job/shipment tracking
- **Template System**: Handlebars templates with customer-specific strategies

### Backend Architecture (NestJS)

**Core Modules:**
- **`pdf/`** - PDF generation service (Puppeteer + Handlebars templates)
- **`customers/`** - Customer management and strategy pattern implementation
- **`jobs/`** - Job processing and batch management
- **`shipments/`** - Shipment tracking and ERP integration
- **`templates/`** - Template management for drag-and-drop editor
- **`pace/`** - PACE API integration for ERP systems
- **`erp/`** - ERP service factory pattern for extensible integrations

**Key Services:**
- **`PdfService`** - Consolidated PDF generation with browser pooling and template caching
- **`CustomerStrategyFactory`** - Factory pattern for customer-specific processing logic
- **`ConcurrencyService`** - Manages batch processing with configurable limits
- **`CsvParserService`** - Common CSV parsing with validation and error handling
- **`PrismaService`** - Database ORM integration

### Customer Strategy Pattern

The system's core extensibility comes from the customer strategy pattern:

**Base Classes:**
- `CustomerStrategy` (abstract) - Template method pattern implementation
- `ICustomerStrategy` - Interface defining required methods
- `CustomerStrategyFactory` - Factory for strategy registration and retrieval

**Implemented Strategies:**
- **`HHGlobalStrategy`** - Standard customer processing
- **`GeorgiaBaptistStrategy`** - Mission board with UPS/POBOX CSV formats  
- **`InquirEDStrategy`** - Educational customer with PM/TE order types

**Strategy Methods:**
- `parseFile()` - Parse uploaded files into standardized format
- `validateData()` - Validate parsed data against business rules
- `generateKits()` - Transform data into packing slip kits
- `customizeTemplate()` - Apply customer-specific branding
- `getShippingRules()` - Define shipping requirements
- `getFileUploadInstructions()` - Provide upload guidance

### Frontend Architecture (Next.js)

**Key Components:**
- **`TemplateCanvas`** - Drag-and-drop template editor with zoom/grid
- **`TemplateElement`** - Individual draggable template elements
- **`CustomerFileUpload`** - File upload with customer strategy selection
- **`PackingSlipLayout`** - Main packing slip generation interface

**State Management:**
- **Zustand Store** (`templateStore.ts`) - Template editing state with undo/redo
- **Template Elements** - Comprehensive element types (text, tables, logos, etc.)
- **Drag & Drop** - @dnd-kit integration for template positioning

### Database Schema (Prisma)

**Core Entities:**
- **`Customer`** - Customer definitions with metadata and strategy codes
- **`Job`** - Processing jobs with file uploads and batch tracking
- **`Shipment`** - Individual shipments with ERP integration
- **`ShipmentItem`** - Line items within shipments
- **`Template`** - Drag-and-drop template definitions with JSON element storage

**Key Relationships:**
- Customer → Jobs (1:N) → Shipments (1:N) → ShipmentItems (1:N)
- Customer → Templates (1:N) for customer-specific templates

## Template System

### Handlebars Templates
Templates are located in `backend/views/templates/`:
- **`default.hbs`** - Standard customer template
- **`georgia-baptist.hbs`** - Georgia Baptist specific layout
- **`inquired.hbs`** - InquirED educational format

**Template Features:**
- Pre-compilation with caching for performance
- Customer strategy-based selection
- CSS integration with embedded styles
- Handlebars helpers for conditional logic (`{{#eq}}`)

### Drag-and-Drop Editor
- **Template Canvas** - Visual WYSIWYG editor with grid overlay
- **Element Types** - Text, company headers, customer info, item tables, logos
- **State Management** - Undo/redo with history tracking
- **Real-time Preview** - Live template preview during editing

## File Processing Pipeline

### Upload Flow
1. **File Upload** - Customer selects strategy and uploads CSV/Excel
2. **Strategy Selection** - System routes to appropriate customer strategy
3. **Parsing** - Strategy parses file into standardized data structure
4. **Validation** - Business rules validation with error reporting
5. **Kit Generation** - Transform data into packing slip kits
6. **PDF Generation** - Batch PDF creation with customer templates

### Batch Processing
- **Chunked Generation** - Process large batches in configurable chunks
- **Browser Pooling** - Reuse Puppeteer browser instances for performance
- **Concurrency Control** - Configurable limits to prevent resource exhaustion
- **Progress Tracking** - Real-time batch processing status
- **Error Recovery** - Individual failure handling without batch abortion

## API Endpoints

### PDF Generation
- `POST /pdf/generate-packing-slip` - Generate single PDF with customer strategy

### Customer Management  
- `GET /customers/strategies` - List available customer strategies
- `GET /customers/instructions/:customerCode` - Get upload instructions
- `POST /customers/upload/:customerCode` - Upload and process files
- `POST /customers/validate/:customerCode` - Validate uploaded data
- `POST /customers/generate-batch/:customerCode` - Generate batch PDFs

### Job Management
- `POST /jobs` - Create new processing job
- `GET /jobs/:id` - Get job details and status
- `PATCH /jobs/:id` - Update job status

### Template Management
- `GET /templates` - List templates
- `POST /templates` - Create new template
- `PUT /templates/:id` - Update template
- `DELETE /templates/:id` - Delete template

## Adding New Customers

To add a new customer strategy:

1. **Create Strategy Directory**: `backend/src/customers/strategies/[customer-name]/`
2. **Implement Strategy Class**: Extend `CustomerStrategy` abstract class
3. **Define Types**: Create TypeScript interfaces in `[customer].types.ts`
4. **Register Strategy**: Add to `CustomerStrategyFactory` in `CustomersService.onModuleInit()`
5. **Create Template**: Add Handlebars template in `backend/views/templates/`
6. **Add Tests**: Comprehensive test coverage for all strategy methods

**Reference Implementation**: See `GeorgiaBaptistStrategy` or `InquirEDStrategy` for examples

## Performance Considerations

### PDF Generation Optimizations
- **Browser Pooling** - Reuse browser instances (5 max pool size)
- **Page Pooling** - Reuse pages for multiple PDFs
- **Template Caching** - Pre-compiled Handlebars templates
- **Concurrency Limits** - Configurable concurrent PDF generation (5 default)

### Database Optimizations  
- **Indexed Fields** - Customer codes, job statuses, ERP shipment IDs
- **Relationship Loading** - Selective include/select for large datasets
- **Connection Pooling** - Prisma connection management

### Memory Management
- **Browser Cleanup** - Automatic browser restart on age/memory thresholds
- **Temporary Files** - Automatic cleanup of generated PDFs
- **Chunk Processing** - Process large batches in memory-efficient chunks

## Environment Variables

### Backend Environment
```bash
NODE_ENV=development|production
PORT=3001
DATABASE_URL="postgresql://user:pass@localhost:5432/dbname"

# PACE API (optional)
PACE_API_URL="https://api.example.com"
PACE_API_KEY="your-api-key"
```

### Frontend Environment  
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Development Notes

### Important Design Patterns
- **Strategy Pattern** - Customer-specific processing logic
- **Factory Pattern** - ERP service instantiation and customer strategy creation  
- **Template Method** - Common processing pipeline in base strategy class
- **Observer Pattern** - Job status updates and progress tracking

### Code Organization Principles
- **Separation of Concerns** - Clear boundaries between modules
- **DRY Elimination** - Consolidated services to remove code duplication
- **Type Safety** - Comprehensive TypeScript interfaces and DTOs
- **Error Handling** - Graceful degradation with detailed error messages

### Testing Strategy
- **Unit Tests** - All services and strategies with Jest
- **Integration Tests** - API endpoints and database interactions
- **E2E Tests** - Complete file processing workflows
- **Customer Strategy Tests** - Comprehensive validation with real data samples

This architecture provides a scalable, maintainable foundation for supporting multiple customers with diverse requirements while maintaining code quality and performance.
