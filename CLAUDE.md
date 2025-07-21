# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a packing slip generator application for Wallace Graphics that parses customer order files and generates customized packing slips. The project is evolving from a CSV-based solution originally built for Just Right Reader into a flexible drag-and-drop interface system that can serve multiple customers.

## Current Status

This is an early-stage project with the following structure:

```
wg-packing-slip-generator/
├── .claude/                # Claude Code session tracking
│   ├── commands/           # Custom Claude commands
│   │   ├── session-current.md
│   │   ├── session-end.md
│   │   ├── session-help.md
│   │   ├── session-list.md
│   │   ├── session-start.md
│   │   └── session-update.md
│   └── sessions/           # Session files
├── frontend/               # NextJS frontend application
│   ├── src/                # Source code
│   ├── public/             # Static assets
│   ├── package.json        # Frontend dependencies
│   └── ...                 # NextJS configuration files
├── backend/                # NestJS backend application
│   ├── src/                # Source code
│   │   ├── customers/      # Customer management and strategies
│   │   ├── pdf/            # PDF generation services
│   │   ├── common/         # Shared utilities and services
│   │   └── main.ts         # Application entry point
│   ├── views/              # Handlebars templates and styles
│   │   ├── templates/      # Customer-specific templates
│   │   └── styles/         # CSS stylesheets
│   ├── test/               # Test files
│   ├── package.json        # Backend dependencies
│   └── ...                 # NestJS configuration files
├── .gitignore              # Git ignore rules
├── package.json            # Root package.json with workspace config
├── CLAUDE.md               # This file - Claude Code guidance
├── README.md               # Project documentation
└── PRD.md                  # Product Requirements Document
```

The project has been initialized with a monorepo structure containing NextJS frontend and NestJS backend.

## Planned Architecture

Based on the PRD.md:

**Frontend:** React/Next.js with drag-and-drop UI capabilities
**Backend:** Node.js/NestJS for data processing and storage
**Database:** PostgreSQL for storing templates and order details
**Key Features:** 
- Drag-and-drop editor for packing slip templates
- Multi-customer support with unique requirements
- Template management and customization

## Development Setup

**Initial Setup:**
```bash
npm run install:all    # Install all dependencies (root, frontend, backend)
```

**Development Commands:**
```bash
npm run dev            # Start both frontend and backend in development mode
npm run dev:frontend   # Start only frontend development server
npm run dev:backend    # Start only backend development server
npm run build          # Build both frontend and backend for production
npm run test           # Run tests for both frontend and backend
npm run lint           # Run linting for both frontend and backend
npm run type-check     # Run TypeScript type checking for both apps
```

**Individual App Commands:**
```bash
cd frontend && npm run dev     # Frontend: http://localhost:3000
cd backend && npm run start:dev # Backend: http://localhost:3001
```

## Key Considerations

- The application needs to be flexible enough to handle different customer requirements
- Templates should be easily customizable without requiring code changes
- The drag-and-drop interface should be intuitive for non-technical users
- Data processing needs to handle various CSV formats and customer-specific data points
- The system should be scalable to support multiple customers simultaneously
- PDF generation should be performant for both single and batch operations
- Customer strategies should be easily extensible for new requirements
- Template system should support customer-specific branding and layouts
- File processing should handle large uploads with proper validation
- System should maintain backward compatibility during updates

## Development History

### Session 1: Project Initialization (2025-07-08 15:15-16:18)
**Status:** ✅ COMPLETED  
**Summary:** Successfully initialized the project structure with NextJS frontend and NestJS backend in a monorepo configuration.

**Completed:**
- Created monorepo structure with workspaces
- Initialized NextJS frontend with TypeScript, Tailwind CSS, ESLint
- Initialized NestJS backend with TypeScript and testing setup
- Configured concurrent development scripts
- Set up build, test, and lint commands for both applications
- Created comprehensive .gitignore configuration
- Updated project documentation

**Key Files Created:**
- `package.json` - Root workspace configuration
- `frontend/` - Complete NextJS application structure
- `backend/` - Complete NestJS application structure
- `.gitignore` - Git ignore rules

**Development Environment Ready:**
- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Both apps configured with TypeScript and ESLint

**Session File:** `.claude/sessions/2025-07-08-1515-initlize-project-structure-with-NextJS-frontend-and-NestJS-backend.md`

### Session 2: UI Implementation with Dummy Data (2025-07-08 16:25-18:10)
**Status:** ✅ COMPLETED  
**Summary:** Complete UI redesign with professional sidebar-based interface, drag-and-drop framework, and PDF generation system.

**Completed:**
- Redesigned UI to match Dribbble inspiration with left sidebar and preview panel
- Created comprehensive component architecture (9 new React components)
- Implemented drag-and-drop elements panel with categorized components
- Built PDF generation system using Puppeteer with exact UI matching
- Achieved perfect print preview consistency with UI and PDF output
- Added loading states and error handling for PDF generation
- Created TypeScript interfaces and dummy data structures

**Key Features Implemented:**
- Modern sidebar layout with Elements, Data, and Settings tabs
- Drag-and-drop framework foundation (visual elements ready)
- Server-side PDF generation with Puppeteer
- Print functionality with consistent styling across all formats
- Professional component architecture with full TypeScript support
- Loading states and error handling

**Technical Achievements:**
- PDF generation endpoint: `POST /pdf/generate-packing-slip`
- Print CSS ensuring exact UI/print/PDF matching
- CORS configuration for frontend-backend communication
- Puppeteer integration with custom HTML generation
- Modular component system for packing slip elements

**Files Added:**
- `backend/src/pdf/` - Complete PDF generation module (service, controller, module)
- `frontend/src/components/` - 9 new React components
- `frontend/src/types/packingSlip.ts` - TypeScript interfaces
- `frontend/src/data/dummyData.ts` - Test data structures

**Dependencies Added:**
- `puppeteer@^24.12.0` - Server-side PDF generation

**Session File:** `.claude/sessions/2025-07-08-1625-UI-implementation-with-dummy-data.md`

### Session 3: Customer Management System (2025-07-17 12:45-14:30)
**Status:** ✅ COMPLETED
**Summary:** Implemented comprehensive customer management system with strategy pattern and CSV parsing capabilities.

**Completed:**
- Created customer strategy pattern for handling different customer requirements
- Implemented CSV parsing service with validation and error handling
- Added customer-specific data transformation strategies
- Built file upload and validation endpoints
- Created customer management controller and service
- Implemented batch PDF generation with customer-specific templates

**Key Features Implemented:**
- Customer strategy factory pattern
- CSV file upload and parsing
- Data validation and transformation
- Batch PDF generation pipeline
- Customer-specific template customization
- Error handling and logging

**Customer Strategies Added:**
- **HH Global Strategy** - Standard customer processing
- **Georgia Baptist Strategy** - Mission board specific requirements
- **InquireEd Strategy** - Educational customer needs

**Technical Achievements:**
- Strategy pattern implementation for scalable customer support
- CSV parsing with validation and error reporting
- Batch PDF generation with concurrency control
- Customer-specific data transformation pipelines
- File upload with security validation

**Files Added:**
- `backend/src/customers/` - Complete customer management module
- `backend/src/common/services/` - Shared utilities (CSV parser, concurrency)
- Customer strategy implementations for each supported customer
- PDF merger service for batch operations

**Dependencies Added:**
- `csv-parser@^3.0.0` - CSV file parsing
- `multer@^1.4.5` - File upload handling
- `pdf-lib@^1.17.1` - PDF manipulation and merging

**Session File:** `.claude/sessions/2025-07-17-1245-add-inquireEd-customer.md`

### Session 4: PDF Config Refactor and Handlebars Templating (2025-07-18 16:00-17:30)
**Status:** ✅ COMPLETED
**Summary:** Refactored PDF generation system to use handlebars templates and eliminated code duplication through service consolidation.

**Phase 1 - Handlebars Implementation:**
- Analyzed existing wg-shipments-service handlebars architecture
- Implemented template-based PDF generation system
- Created customer-specific handlebars templates
- Built template caching and pre-compilation system
- Added dynamic template selection based on customer strategy

**Phase 2 - DRY Consolidation:**
- Identified and eliminated 90%+ duplicate code across PDF services
- Consolidated 4 services into 2 focused services
- Unified browser management and page pooling
- Removed ~500 lines of duplicate code
- Improved resource management and performance

**Template System:**
- **Handlebars Templates** - Dynamic content generation
- **Customer Strategy Selection** - Automatic template selection
- **Template Caching** - Pre-compilation for performance
- **CSS Integration** - Styles embedded in templates
- **Multi-customer Support** - Different templates per customer

**Services Consolidated:**
- **PdfService** - Single, comprehensive PDF generation service
- **PdfMergerService** - Dedicated PDF merging utility
- **Eliminated:** TemplatePdfService, FileBasedPdfService (redundant)

**Templates Created:**
- `backend/views/templates/default.hbs` - Standard customer template
- `backend/views/templates/georgia-baptist.hbs` - Georgia Baptist specific
- `backend/views/templates/inquire-ed.hbs` - InquireEd specific
- `backend/views/styles/base.css` - Base CSS styles

**Architecture Benefits:**
- Single source of truth for PDF generation
- Unified resource management and browser pooling
- Template-based customization without code changes
- Improved maintainability and testing
- Better performance through shared resources

**Dependencies Added:**
- `handlebars@^4.7.8` - Template engine
- `@types/handlebars@^4.1.0` - TypeScript support

**Session File:** `.claude/sessions/2025-07-18-1600-pdf-config-refactor-and-handlebars-tempalting.md`

## Current Architecture

### Backend Architecture
**Framework:** NestJS with TypeScript
**PDF Generation:** Puppeteer + Handlebars templates
**File Processing:** CSV parsing with validation
**Customer Management:** Strategy pattern for multi-customer support

### Key Services:
- **PdfService** - Consolidated PDF generation (single + batch)
- **PdfMergerService** - PDF merging utility
- **CustomersService** - Customer management and file processing
- **CustomerStrategyFactory** - Strategy pattern implementation
- **CsvParserService** - CSV file parsing and validation
- **ConcurrencyService** - Batch processing with limits

### Template System:
- **Handlebars Templates** - Dynamic content generation
- **Customer Strategies** - Template selection based on customer
- **Template Caching** - Pre-compilation for performance
- **CSS Integration** - Embedded styles in templates

### API Endpoints:
- `POST /pdf/generate-packing-slip` - Single PDF generation
- `POST /customers/upload` - File upload and processing
- `GET /customers/strategies` - Available customer strategies
- `POST /customers/generate-batch` - Batch PDF generation

## Next Steps

1. ✅ ~~Initialize the project structure with the chosen tech stack~~ (COMPLETED)
2. ✅ ~~Set up the development environment and tooling~~ (COMPLETED)
3. ✅ ~~Implement the drag-and-drop interface components~~ (COMPLETED - Framework ready)
4. ✅ ~~Build the template management system~~ (COMPLETED - Handlebars templates)
5. ✅ ~~Add customer-specific customization capabilities~~ (COMPLETED - Strategy pattern)
6. ✅ ~~Implement CSV parsing functionality~~ (COMPLETED - Multi-format support)
7. ✅ ~~Consolidate PDF generation services~~ (COMPLETED - DRY elimination)
8. Implement drag-and-drop positioning logic and state management
9. Set up PostgreSQL database connection
10. Create API endpoints for template management and persistence
11. Add authentication and user management
12. Implement real-time template preview
13. Add template editor functionality
14. Create customer dashboard and analytics
15. Add automated testing suite

## Dependencies Overview

### Backend Dependencies:
- `@nestjs/core` - NestJS framework
- `puppeteer` - PDF generation
- `handlebars` - Template engine
- `csv-parser` - CSV file processing
- `multer` - File upload handling
- `pdf-lib` - PDF manipulation
- `jszip` - ZIP file creation

### Frontend Dependencies:
- `next` - React framework
- `react` - UI library
- `typescript` - Type safety
- `tailwindcss` - Styling
- `@dnd-kit/core` - Drag and drop

## Testing

To run tests:
```bash
npm run test           # Run all tests
npm run test:backend   # Backend tests only
npm run test:frontend  # Frontend tests only
```

## Deployment

To build for production:
```bash
npm run build          # Build both apps
npm run build:backend  # Backend only
npm run build:frontend # Frontend only
```