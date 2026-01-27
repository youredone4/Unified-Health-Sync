# GeoHealthSync - Barangay Health Information & Analytics System

## Overview

GeoHealthSync is a demo web application designed for Barangay Health Offices in the Philippines. It serves as a health information management and analytics system for tracking prenatal care, child immunizations, senior citizen medication pickups, and medical supply inventory across multiple barangays (villages).

The application is specifically designed for users with low digital literacy, emphasizing simple language, clear visual status indicators, and action-first workflows. It uses a worklist-driven approach where healthcare workers see their most urgent tasks (overdue and due soon items) prominently.

**Key Features:**
- Municipal dashboard with cross-module analytics
- Prenatal module for tetanus toxoid (TT) vaccination tracking
- Child health module for immunization schedules and growth monitoring
- Senior care module for hypertension medication pickup tracking
- Inventory management for vaccines and medications by barangay
- SMS notification system (demo mode)
- Interactive map of health facilities

## User Preferences

Preferred communication style: Simple, everyday language.

## Authentication & Authorization

### Username/Password Authentication
The system uses session-based username/password authentication. There is NO social login, no Replit Auth, and no self-registration. All user accounts are created and managed by System Administrators.

**Key Features:**
- Session-based authentication with PostgreSQL session store
- bcrypt password hashing (10 salt rounds)
- Sessions expire after 1 week
- No self-registration - all users created by admin

**Default Admin Credentials:**
- Username: `admin`
- Password: `admin123`
- The admin account is auto-seeded on first startup if no admin exists

**Auth Files:**
- `server/auth.ts` - Authentication setup, password hashing, session management, auth routes
- `client/src/hooks/use-auth.ts` - React hook for authentication state
- `client/src/pages/landing.tsx` - Login page with username/password form

### Role-Based Access Control (RBAC)

**Roles:**
- `SYSTEM_ADMIN` - Full access, can manage users and view audit logs
- `MHO` - Municipal Health Officer, management access
- `SHA` - Sanitary Health Aide, operational access  
- `TL` - Team Leader, restricted to assigned barangays only

**TL Barangay Scoping:**
Team Leaders can only access data from their assigned barangays. The `user_barangay_assignments` table links TL users to specific barangays.

**RBAC Middleware:**
- `server/middleware/rbac.ts` - Middleware for role checking and TL barangay scoping
- `loadUserInfo` - Loads user session info
- `requireAuth` - Requires authentication
- `requireRole` - Requires specific roles

### User Management
System Admins can manage users at `/admin/users`:
- Create users with username, password, role, barangay assignments
- Edit user roles and status
- Reset user passwords
- Delete users (cannot delete self)

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (dark mode default)
- **Charts**: Recharts for data visualization
- **Maps**: React-Leaflet with OpenStreetMap tiles
- **Build Tool**: Vite

The frontend follows a module-based architecture with each health program (Prenatal, Child Health, Senior Care) having its own worklist, dashboard, registry, and profile views. Components are organized around the UI rules emphasizing accessibility for low-literacy users.

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Pattern**: RESTful endpoints defined in `shared/routes.ts`
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Validation**: Zod with drizzle-zod integration
- **Build**: esbuild for server bundling, Vite for client

The server uses a storage abstraction pattern (`IStorage` interface) that enables easy swapping of data backends. Routes are organized by entity (mothers, children, seniors, inventory, health-stations, sms).

### Data Layer
- **Database**: PostgreSQL (configured via DATABASE_URL environment variable)
- **Schema Location**: `shared/schema.ts` - contains all table definitions
- **Migrations**: Drizzle Kit with `db:push` command

Key entities:
- `mothers` - Prenatal patients with TT vaccination tracking
- `children` - Immunization records with vaccine JSON and growth measurements
- `seniors` - Hypertension medication pickup tracking (with seniorUniqueId for cross-barangay verification)
- `inventory` - Vaccine and medication stock by barangay
- `healthStations` - Facility locations with coordinates
- `smsOutbox` - Demo SMS message queue
- `barangays` - Registered barangays (Poblacion, San Isidro, Mabini, Rizal, Buenavista)

**M1 Template System Tables:**
- `m1_template_versions` - Template version records for DOH FHSIS M1Brgy
- `m1_indicator_catalog` - 121 indicators covering all sections of the M1Brgy form (FP, A-K)
- `m1_report_instances` - Per-barangay/month report instances with DRAFT/SUBMITTED workflow
- `m1_indicator_values` - Stored indicator values with valueSource (COMPUTED/ENCODED/IMPORTED)
- `municipality_settings` - Municipality-level branding settings
- `barangay_settings` - Barangay-level branding overrides
- `senior_med_claims` - Cross-barangay medication claim verification for seniors
- `audit_logs` - System-wide audit logging

**Cross-Barangay Medication Verification:**
The senior profile page includes medication claim verification that prevents duplicate claims across barangays. Seniors with a `seniorUniqueId` can be tracked for medication pickups across all barangays in the municipality. The system checks eligibility before recording claims and shows claim history with barangay names and dates.

**M1 Report CSV Import:**
The M1 report encoding page supports CSV file import for bulk entry of indicator values. Expected CSV format: `row_key, column_key, value` (e.g., `FP-01, M, 25`). Values are validated against the indicator catalog before import and displayed for preview. Imported values have `valueSource: 'IMPORTED'`.

### Health Logic
All date-based health status calculations (overdue, due soon, upcoming) are computed client-side in `client/src/lib/healthLogic.ts`. This file contains the core business logic for determining vaccination schedules, prenatal check deadlines, and medication pickup status based on a fixed demo date.

### Path Aliases
- `@/*` → `./client/src/*`
- `@shared/*` → `./shared/*`
- `@assets/*` → `./attached_assets/*`

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Database toolkit for TypeScript with type-safe queries
- **connect-pg-simple**: PostgreSQL session store (available but sessions not currently implemented)

### UI Libraries
- **Radix UI**: Full suite of accessible primitives (dialog, dropdown, tabs, etc.)
- **shadcn/ui**: Component library built on Radix (new-york style variant)
- **Tailwind CSS**: Utility-first styling with custom theme configuration
- **Lucide React**: Icon library

### Data & Visualization
- **TanStack React Query**: Async state management with caching
- **Recharts**: Charting library for dashboards
- **date-fns**: Date manipulation for health schedule calculations

### Mapping
- **Leaflet**: Core mapping library
- **React-Leaflet**: React bindings for Leaflet
- Map tiles from OpenStreetMap/CartoDB

### Development
- **Vite**: Frontend build tool with HMR
- **TSX**: TypeScript execution for Node.js
- **Replit plugins**: Runtime error overlay, cartographer, dev banner (development only)