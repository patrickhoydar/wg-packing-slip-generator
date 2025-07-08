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
│   ├── test/               # Test files
│   ├── package.json        # Backend dependencies
│   └── ...                 # NestJS configuration files
├── .gitignore              # Git ignore rules
├── package.json            # Root package.json with workspace config
├── CLAUDE.md               # This file - Claude Code guidance
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

## Next Steps

1. ✅ ~~Initialize the project structure with the chosen tech stack~~ (COMPLETED)
2. ✅ ~~Set up the development environment and tooling~~ (COMPLETED)
3. Set up PostgreSQL database connection
4. Create API endpoints for template management
5. Implement the drag-and-drop interface components
6. Build the template management system
7. Add customer-specific customization capabilities
8. Implement CSV parsing functionality