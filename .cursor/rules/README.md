# Cursor Rules for FindPhotosOfMe

This directory contains Cursor AI rules to help with development across the monorepo.

## Rule Files

### 00-architecture.mdc

**Always Applied** - Core architecture and project overview

- Project structure and tech stack
- Data flow and communication patterns
- Key conventions (SOLID, logging, documentation)
- Environment variables
- File naming conventions

### convex-backend.mdc

**Applied to**: `packages/backend/convex/**/*.ts`

- Convex function syntax (queries, mutations, actions)
- Validators and type safety
- Database operations and indexing
- Schema definitions
- Common patterns (status tracking, progress updates)

### vue-nuxt-frontend.mdc

**Applied to**: `apps/web/**/*.vue`, `apps/web/**/*.ts`

- Vue 3 Composition API patterns
- Convex integration (useConvexQuery, useConvexMutation)
- shadcn-vue components
- TypeScript patterns with Convex types
- Form handling and API calls

### python-ml-service.mdc

**Applied to**: `python/**/*.py`

- FastAPI patterns and structure
- Service classes (FaceRecognition, R2Storage, ConvexClient)
- Detailed logging requirements
- Face recognition and embedding patterns
- Async operations and progress tracking

### monorepo-workspace.mdc

**Applied to**: `package.json`, `pnpm-workspace.yaml`, `turbo.json`

- pnpm workspace management
- Turborepo commands
- Cross-workspace dependencies
- Development workflow
- Deployment strategies

## How Cursor Uses These Rules

1. **00-architecture.mdc** is always active to provide context
2. Other rules activate based on the file you're editing (via `globs`)
3. Rules reference key files using `[filename](mdc:path/to/file)` format
4. AI uses these rules to understand project conventions and patterns

## Updating Rules

When project conventions change:

1. Update the relevant `.mdc` file
2. Cursor automatically picks up changes
3. No restart needed

## Key Features

- **Single Responsibility**: Each rule file covers one domain
- **Context-Aware**: Rules apply to relevant files only
- **Cross-Referenced**: Rules link to actual project files
- **User Preferences**: Incorporates logging, SOLID, and documentation preferences
