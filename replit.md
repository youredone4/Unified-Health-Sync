# HealthSync - Unified Digital Health Information System

## Overview

HealthSync is a demo web application designed for Barangay Health Offices in the Philippines. It serves as a health information management and analytics system for tracking prenatal care, child immunizations, senior citizen medication pickups, and medical supply inventory across multiple barangays (villages).

The application is specifically designed for users with low digital literacy, emphasizing simple language, clear visual status indicators, and action-first workflows. It uses a worklist-driven approach where healthcare workers see their most urgent tasks (overdue and due soon items) prominently.

**Key Features:**
- Municipal dashboard with cross-module analytics
- Prenatal module for tetanus toxoid (TT) vaccination tracking
- Child health module for immunization schedules and growth monitoring
- Senior care module for hypertension medication pickup tracking
- Inventory management for vaccines and medications by barangay
- SMS notification system (demo mode)
- Interactive map of health facilities
- AI-powered predictive health analytics with trend analysis
- KYC assistive face-match verification (OpenAI Vision, advisory only)

## Health Analytics

The Health Analytics module (`/reports/ai`) provides predictive health analytics:

**Key Features:**
- Period-over-period trend analysis comparing last 30 days vs previous 30 days
- Risk scoring for barangays across 5 health categories
- High-risk patient identification with clinical criteria
- Predictions with confidence levels and timeframes

**Trend Metrics:**
- Immunization: BCG vaccination activity trends
- TT Vaccination: Maternal tetanus toxoid trends
- Medication Compliance: Senior medication pickup trends
- TB Adherence: DOTS treatment adherence trends
- Disease Incidence: New case reporting trends

**Risk Levels:**
- HIGH: Immediate attention needed (red)
- MEDIUM: Monitoring required (yellow)
- LOW: Acceptable performance (green)

**High-Risk Criteria:**
- Mothers: No TT + active status, overdue TT by GA weeks, age <18 or >35
- Children: Low birth weight or missing critical vaccines
- Seniors: Blood pressure ≥160/100
- TB: Multiple missed doses

**Files:**
- `server/ai-insights.ts` - Backend analytics engine
- `client/src/pages/ai-reporting.tsx` - Analytics dashboard UI

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

**M1 Report Access:**
- TL role now has access to `/reports/m1` (previously MGMT only)
- TL is auto-locked to their assigned barangay (dropdown replaced with locked display)
- TL cannot reopen SUBMITTED_LOCKED reports (only MHO/Admin can)
- All M1 API routes now require authentication (`[loadUserInfo, requireAuth]`)

### Self-Registration & KYC Verification
Healthcare workers (SHA, TL roles) can self-register at the login page:
- 3-step registration wizard: Account Setup → Personal Info → KYC Upload
- KYC uploads (government ID photo, optional selfie) stored in `uploads/kyc/` (server-only)
- New accounts start as `PENDING_VERIFICATION` — cannot log in until approved
- Login blocked for PENDING/REJECTED users with informative messages

**Admin KYC Review** (`/admin/users` → Pending Approvals tab):
- Approve button → activates account instantly
- Reject button → requires rejection reason; user sees reason on next login attempt
- KYC files viewable by admins only via `/api/admin/kyc-files/:userId?type=id` or `?type=selfie` (no raw filename exposure)
- **AI Face-Match badge** shows HIGH_MATCH / POSSIBLE_MATCH / LOW_MATCH / INCONCLUSIVE / NO_SELFIE — advisory only, never auto-approves

**KYC Assistive Face-Match:**
- Runs asynchronously after registration via `setImmediate` (does not block API response)
- Compares government ID photo vs. webcam selfie using OpenAI Vision (gpt-4o-mini)
- Results stored as `kycFaceMatchStatus`, `kycFaceMatchScore`, `kycFaceMatchReason` on users table
- Selfie is now **mandatory** in registration Step 3 — captured via in-browser webcam (no file upload)
- Service: `server/kyc-face-match.ts`; PDFs fallback gracefully to INCONCLUSIVE

### User Management
System Admins can manage users at `/admin/users`:
- Create users with username, password, role, barangay assignments
- Edit user roles and status (Active/Disabled/Rejected)
- Quick disable/re-enable toggle on each user row
- Reset user passwords (separate dialog)
- Delete users (cannot delete self)
- Two tabs: "All Users" and "Pending Approvals" (with count badge)

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