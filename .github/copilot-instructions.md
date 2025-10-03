# Finanzas App - AI Coding Instructions

## Project Overview
Full-stack TypeScript finance management app for Bioalergia with React + Vite frontend and Express + MySQL backend. Key focus: Mercado Pago transaction processing, role-based access control, and branded financial reporting.

## Architecture & Key Patterns

### Development Workflow
- `npm run dev:full` - Concurrent frontend + backend development (essential for full-stack work)
- `npm run predev:full` - Auto-kills conflicting processes via `scripts/reset-dev.mjs`
- Backend: `npm run server` (Express on :4000), Frontend: `npm run dev` (Vite on :5173)
- API proxying: `/api/*` automatically proxies to backend in development

### Authentication & Authorization System
- **Cookie-based JWT auth** (not header-based): uses `mp_session` HTTP-only cookie
- **Role hierarchy**: `GOD > ADMIN > ANALYST > VIEWER` (GOD bypasses all role checks)
- **Role governance**: Employee roles in `employees` table can override user roles via `role_mappings`
- **Auth pattern**: All protected routes use `authenticate` middleware, UI uses `hasRole(...roles)` for access control
- **Critical**: Always use `credentials: "include"` in API calls for session cookies

### Frontend Architecture

#### Feature Organization
Features live in `src/features/{feature}/` with consistent structure:
- `api.ts` - API client calls using shared `apiClient` from `src/lib/apiClient.ts`
- `types.ts` - TypeScript interfaces
- `components/` - Feature-specific React components
- `hooks/` - Custom React hooks
- `utils.ts` - Business logic utilities

#### Navigation & Layout
- **Glass-morphism design system**: Uses CSS custom properties and Tailwind v4
- **Route-based role filtering**: `NAV_SECTIONS` in `App.tsx` filters menu items by user role
- **Context pattern**: `AuthContext` and `SettingsContext` provide global state

### Backend Architecture

#### Database Layer (`server/db.ts`)
- **Connection pooling**: Single `getPool()` instance, auto-reconnection handling
- **Schema management**: `ensureSchema()` creates tables on startup, handles admin user creation
- **Type safety**: Explicit TypeScript interfaces for all database records

#### Route Organization
- **Modular routes**: Each feature has dedicated route file in `server/routes/`
- **Middleware pattern**: `authenticate`, `asyncHandler` for consistent error handling
- **Registration pattern**: Routes register via `registerXXXRoutes(app)` functions

### Data Processing Patterns

#### CSV/Excel Handling
- **Parser flexibility**: Auto-detects separators `,`, `;`, `|` in `src/mp/reports.ts`
- **Dual processing**: Local analysis (`/report`) vs database upload (`/upload`)
- **Format preference**: Use CSV with `papaparse` over Excel unless specifically needed

#### Currency & Formatting
- **Shared utilities**: `shared/currency.ts` for consistent rounding with `roundCurrency()`
- **Localization**: Chilean peso formatting via `fmtCLP()` in `src/lib/format.ts`
- **Amount coercion**: `coerceAmount()` handles various input formats

### Styling System

#### Tailwind v4 Integration
- **No config files**: Uses `@tailwindcss/vite` plugin, styles in `src/index.css`
- **CSS custom properties**: Brand colors as `--brand-primary`, `--brand-secondary`
- **Glass morphism**: Pre-defined `.glass-panel` classes for consistent UI
- **Theme management**: Settings stored in database, dynamic CSS variables

### Key Development Conventions

#### Error Handling
- **Structured logging**: Use `logger` from `src/lib/logger.ts` with context
- **API responses**: Consistent `{ status: "ok"|"error", message?, ...data }` format
- **Zod validation**: All API inputs validated via schemas in `server/schemas.ts`

#### File Organization
- **Shared code**: `shared/` for frontend+backend utilities (currency, time)
- **Path aliases**: `@/` for `src/`, `~/` for root (configured in `vite.config.ts`)
- **Type imports**: Use `type` imports for types, regular imports for runtime code

#### Build & Deployment
- **Dual builds**: `npm run build` (frontend), `npm run build:server` (backend)
- **Production serving**: Express serves built frontend at `/intranet/` base path
- **Environment**: `.env` for database, JWT secrets, admin credentials

## Common Gotchas
- Always include context lines when editing files (not just target code)
- Role checks: Remember `GOD` role bypasses all restrictions
- Database queries: Use parameterized queries, avoid SQL injection
- API calls: Include `credentials: "include"` for authentication
- Currency: Always use `roundCurrency()` for financial calculations