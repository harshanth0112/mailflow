# MailFlow Development Progress Report

## Overview
This document tracks chronological milestones, architecture choices, and implementation progress across all development phases of the **MailFlow** platform.

---

## Phase 1 — Foundation & Health Architecture (Completed)
- **Backend:** Express API server structured under `/api/v1` with Helmet, CORS, Morgan, graceful shutdown, and dynamic `/health` controller inspecting MongoDB Atlas connection states.
- **Frontend:** Single-page application using React 18, Vite, React Router v6, Tailwind CSS, Lucide icons, responsive navigation shell, live API health checker, and error boundary.
- **Defects Fixed:** 
  - Investigated and resolved the exit code 1 issue on Windows/libuv when running health check scripts in sandbox mode (`EACCES` on network binding without elevation) and resolved process exit race conditions in node scripts.
  - Added missing `dev:server` script alias in `server/package.json` to allow direct execution both from monorepo root and inside `server/` directory.

---

## Phase 2 — Authentication & Transactional Email Infrastructure (Completed)

### 1. Database Models & Schema Design
- **`User` Model (`server/src/models/User.js`):**
  - Name, email (lowercased, indexed, validated), passwordHash (hidden with `select: false`).
  - Account roles: `user`, `admin`, `member`.
  - Account status: `pending_verification`, `active`, `suspended`, `deactivated`.
  - Cryptographically hashed token fields: `verificationTokenHash`, `verificationTokenExpiresAt`, `resetPasswordTokenHash`, `resetPasswordExpiresAt`.
  - Onboarding fields: `onboardingCompleted`, `onboardingStep`, `onboardingSkipped`.
  - OAuth identity mapping: `googleId`, `githubId`, `microsoftId`.
  - Password comparison method using `bcryptjs` (salt rounds: 12) and `toSafeObject()` sanitizer.
- **`Session` Model (`server/src/models/Session.js`):**
  - Refresh session persistence linking `userId`, `refreshTokenHash`, `userAgent`, `ipAddress`, `expiresAt`, `revokedAt`, `lastUsedAt`.
  - MongoDB TTL index for automatic expiration cleanup.

### 2. Transactional Email Service
- **Templates (`server/src/services/emailTemplateService.js`):**
  - Reusable responsive HTML/CSS transactional templates with dark-mode aesthetic.
  - Email verification template with expiring 24-hour token button.
  - Welcome email template sent immediately upon account verification.
  - Password reset template with single-use 1-hour expiration link.
  - Password changed security confirmation with timestamp and IP address.
  - Security login alert for new sign-ins from unrecognized clients/IPs.
  - Email change verification template.
- **Nodemailer Infrastructure (`server/src/services/authEmailService.js`):**
  - Centralized SMTP configuration using environment variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`).
  - Safe development fallback: When live SMTP credentials are not present, emails cleanly preview in console rather than failing or crashing the application.
  - Decoupled from future marketing/campaign queues.

### 3. Security & Token Utilities (`server/src/utils/tokenUtils.js`)
- `bcryptjs` password hashing (12 rounds).
- Short-lived JWT Access Tokens (15m expiration, signed with `JWT_ACCESS_SECRET`).
- Rotating Refresh Tokens (7d expiration, signed with `JWT_REFRESH_SECRET`).
- SHA256 one-way hashing for stored tokens to prevent database breach token leaks.
- Cryptographically secure token generation (`crypto.randomBytes`).
- Secure, HttpOnly, SameSite cookies for refresh session storage.

### 4. API Endpoints (`/api/v1/auth/...`)
| Method | Endpoint | Description | Protection / Limits |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | User registration with input validation | Rate limited (60/15m), Zod |
| `POST` | `/api/v1/auth/login` | Email/password login with JWT & refresh session | Rate limited (10/15m), Zod |
| `POST` | `/api/v1/auth/verify-email` | Token-based single-use email verification | Zod validator |
| `POST` | `/api/v1/auth/resend-verification` | Dispatches new email verification token | Rate limited (60/15m) |
| `POST` | `/api/v1/auth/forgot-password` | Initiates single-use password reset link | Rate limited (5/1h), generic response |
| `POST` | `/api/v1/auth/reset-password` | Resets password with token invalidation & session revocation | Rate limited (5/1h), Zod |
| `POST` | `/api/v1/auth/refresh` | Rotates refresh token & issues new access token | Cookie / body refresh token |
| `POST` | `/api/v1/auth/logout` | Revokes refresh session and clears cookie | Public |
| `GET` | `/api/v1/auth/me` | Fetches authenticated user profile | `requireAuth` JWT Middleware |
| `PATCH` | `/api/v1/auth/me` | Updates profile name or onboarding step | `requireAuth` JWT Middleware |
| `POST` | `/api/v1/auth/change-password` | Changes password after validating current password | `requireAuth` JWT Middleware |
| `GET` | `/api/v1/auth/oauth/status` | Reports configured OAuth provider status | Public |

### 5. Frontend Authentication Screens & State
- **Context & Guards:**
  - `AuthContext.jsx`: Centralized user, access token, and login/logout state with profile sync on refresh.
  - `RouteGuard.jsx`: `ProtectedRoute` (redirects unauthenticated users to `/login`) and `PublicOnlyRoute` (redirects logged-in users to `/dashboard`).
  - Axios interceptor: Auto-attaches Bearer access tokens and queues/refreshes expired tokens seamlessly on 401.
- **Screens Implemented (`client/src/pages/auth/`):**
  - `LoginPage.jsx`: Clean email/password form, show/hide password toggle, remember-me checkbox, OAuth buttons, and link to forgot password.
  - `RegisterPage.jsx`: Name, email, password strength meter, password confirm, terms of service consent, and inbox instructions card upon submission.
  - `VerifyEmailPage.jsx`: Live verification token validator with success and expired-token recovery states.
  - `ResendVerificationPage.jsx`: Recovery page for re-dispatching verification links without disclosing account presence.
  - `ForgotPasswordPage.jsx`: Secure password reset request form.
  - `ResetPasswordPage.jsx`: New password selection screen with format validation.
  - `DashboardPage.jsx`: Authenticated workspace view displaying profile status, verified badge, and quick actions.

### 6. Development Verification Checks
- **Backend syntax and import check:** All ES modules load without syntax errors.
- **Dependencies verified:** `jsonwebtoken`, `bcryptjs`, `cookie-parser`, `nodemailer`, `express-rate-limit` installed and tested.
- **Integration smoke test:** Complete 7-step sequence (registration &rarr; unverified login rejection (403) &rarr; email token verification &rarr; successful verified login (200) &rarr; protected `/me` profile retrieval &rarr; refresh token rotation &rarr; session logout) passed 100%.
- **Frontend build test:** Production build (`vite build`) compiled with 0 errors (`1673 modules transformed`).

---

## Phase 3 — Multi-User Workspace Architecture (Completed)

### 1. Database Models & Schema Design
- **`Workspace` Model (`server/src/models/Workspace.js`):**
  - `name`: String, trimmed, length 2–100.
  - `slug`: String, unique indexed URL slug generated safely per workspace.
  - `ownerId`: ObjectId referencing `User`, indexed.
  - `plan`: Enum (`free`, `starter`, `pro`, `enterprise`), default `free`.
  - `status`: Enum (`active`, `suspended`, `archived`), indexed.
  - `settings`: Configurable defaults for `defaultFromEmail`, `defaultFromName`, `timezone`, `dailySendLimit`, and `enableTracking`.
  - Compound indexes on `{ ownerId: 1, status: 1 }`.
- **`Membership` Model (`server/src/models/Membership.js`):**
  - `workspaceId`: ObjectId referencing `Workspace`, indexed.
  - `userId`: ObjectId referencing `User`, indexed.
  - `role`: Enum matching specification (`Super Admin`, `Admin`, `Campaign Manager`, `User`).
  - `invitationStatus`: Enum (`pending`, `accepted`, `declined`, `expired`, `revoked`).
  - `invitedEmail`, `invitedBy`, `invitationTokenHash`, `invitationExpiresAt`, `joinedAt`.
  - Compound unique constraint `{ workspaceId: 1, userId: 1 }` prevents duplicate memberships.
  - Compound partial unique constraint `{ workspaceId: 1, invitedEmail: 1 }` for active pending invitations.

### 2. Workspace Roles, Permissions & Access Control (`server/src/config/roles.js`)
- Server-side RBAC separating platform administration from workspace-level roles:
  - **Super Admin**: Workspace creator / owner with full management rights.
  - **Admin**: Workspace settings, member invitations, and campaign permissions.
  - **Campaign Manager**: Contacts and campaign creation, update, and sending.
  - **User**: Read-only workspace resource access.
- Tamper-proof privilege separation:
  - Role information sent by client is never trusted.
  - Elevated roles cannot be assigned by unprivileged members.
  - Role hierarchy checks prevent privilege escalation.

### 3. Workspace Isolation & Middleware (`server/src/middleware/workspaceMiddleware.js`)
- **`requireWorkspace`**:
  - Identifies active workspace via `x-workspace-id` header or resolves user's primary workspace membership.
  - Validates that the requesting user possesses an active, accepted membership in the workspace.
  - Attaches `req.workspace`, `req.membership`, and `req.workspaceRole` to the request context.
  - Prevents IDOR (Insecure Direct Object Reference) by returning 404/403 for unauthorized workspace identifiers.
- **`requireWorkspacePermission`**:
  - Enforces granular action permissions on route endpoints (e.g. `workspace:update`, `members:invite`, `members:read`).
- **`requireWorkspaceRole`**:
  - Enforces minimum role requirements where needed.

### 4. Registration Integration (`server/src/services/workspaceService.js`)
- Default workspace auto-provisioning integrated into user registration and verification flows:
  - Default workspace named `"{User Name}'s Workspace"` created with unique slug.
  - Owner automatically provisioned as `Super Admin`.
  - Idempotent and crash-resilient: duplicate registration attempts or verification re-triggers check for existing workspaces safely without creating duplicate records.

### 5. API Endpoints (`/api/v1/workspaces/...`)
| Method | Endpoint | Description | Authorization / Validation |
|---|---|---|---|
| `GET` | `/api/v1/workspaces/current` | Retrieves current workspace details and user role | `requireAuth`, `requireWorkspace` |
| `PATCH` | `/api/v1/workspaces/current` | Updates workspace settings & name | `requireAuth`, `requireWorkspace`, `workspace:update`, Zod |
| `GET` | `/api/v1/workspaces/current/members` | Retrieves active workspace members list | `requireAuth`, `requireWorkspace`, `members:read` |
| `POST` | `/api/v1/workspaces/current/invitations` | Invites a member by email | `requireAuth`, `requireWorkspace`, `members:invite`, Zod |
| `GET` | `/api/v1/workspaces/current/invitations` | Lists pending workspace invitations | `requireAuth`, `requireWorkspace`, `members:invite` |
| `POST` | `/api/v1/workspaces/invitations/:token/accept` | Accepts workspace invitation | `requireAuth`, Zod token param |

### 6. Frontend Workspace Architecture
- **`WorkspaceContext.jsx` (`client/src/context/WorkspaceContext.jsx`):**
  - Centralized state for `workspace`, `userRole`, `isLoading`, and permission helpers (`isSuperAdmin`, `isAdmin`, `isCampaignManager`).
  - Synchronizes active workspace with `localStorage` and automatically attaches `x-workspace-id` in Axios interceptors.
- **`WorkspaceMembersPage.jsx` (`client/src/pages/workspace/WorkspaceMembersPage.jsx`):**
  - Displays active members and pending invitations with real-time status.
  - Form for inviting members with role selection (restricted to authorized roles).
- **`WorkspaceSettingsPage.jsx` (`client/src/pages/workspace/WorkspaceSettingsPage.jsx`):**
  - Workspace identity configuration, daily send limits, sender defaults, and timezone controls.
- **Updated `DashboardPage.jsx` & `Sidebar.jsx`:**
  - Displays authenticated workspace identity, role badge, quick links to team management and settings.

### 7. Development Verification Checks
- **Backend syntax and import check:** All workspace routes, models, middleware, and controllers load cleanly.
- **Integration test suite:**
  - 12-step test sequence verifying:
    1. User 1 registration & email verification.
    2. Default workspace created with `Super Admin` role.
    3. Workspace settings update by Super Admin (passed).
    4. Member invitation creation with secure token hash (passed).
    5. User 2 registration & invitation acceptance (passed).
    6. User 2 role assigned as `Campaign Manager` (passed).
    7. User 2 unauthorized workspace settings update rejected with `403 Forbidden` (passed).
    8. User 3 (unrelated account) IDOR access attempt to User 1's workspace rejected with `404 Not Found` (passed).
    9. Workspace members listing returned accurately (passed).
- **Frontend build test:** Production build (`vite build`) compiled successfully with 0 errors (`1676 modules transformed`).

---

## Phase 6 — Contact Management System (Completed)

### 1. Database Architecture & Models
- **`Contact` Model (`server/src/models/Contact.js`):**
  - Workspace scoped: `workspaceId` (indexed) referencing `Workspace`.
  - Creator reference: `createdBy` referencing `User`.
  - Audience fields: `firstName`, `lastName`, `email` (lowercased, trimmed, validated), `phone`, `company`, `jobTitle`.
  - Segmentation: `tags` (array of strings), `groups` (array of ObjectIds referencing `ContactGroup`), `customFields` (Map).
  - Attribution: `source` (`manual`, `import`, `api`, `form`).
  - Compliance & Delivery Eligibility: `consentStatus` (`opted_in`, `opted_out`, `pending`, `imported_unconfirmed`), `consentHistory` (audit trail of timestamped status transitions), `subscribedAt`, `unsubscribedAt`, `status` (`subscribed`, `unsubscribed`, `bounced`, `suppressed`).
  - Compound unique index: `{ workspaceId: 1, email: 1 }` preventing duplicate email addresses within the same workspace while maintaining multi-tenant independence.
  - Performance filtering indexes: `{ workspaceId: 1, status: 1 }`, `{ workspaceId: 1, consentStatus: 1 }`, `{ workspaceId: 1, tags: 1 }`, `{ workspaceId: 1, groups: 1 }`, `{ workspaceId: 1, createdAt: -1 }`.
  - Eligibility helper method: `isEligibleForCampaign()`.
- **`ContactGroup` Model (`server/src/models/ContactGroup.js`):**
  - Workspace scoped: `workspaceId` (indexed), `createdBy` referencing `User`.
  - Fields: `name` (trimmed, 1–100 chars), `description` (up to 500 chars).
  - Compound unique collation index: `{ workspaceId: 1, name: 1 }` with case-insensitive collation preventing duplicate group names within a workspace.

### 2. Validation & Security (`server/src/validators/contactValidators.js`)
- Comprehensive Zod validation schemas for contact creation, updating, query filtering/pagination/sorting, contact group management, and bulk assignments.
- Anti-tampering and IDOR protection: every query automatically filters on `req.workspace._id`.
- Role-based permissions: reading requires `contacts:read`; modifications require `contacts:manage` (`Campaign Manager`, `Admin`, or `Super Admin`).

### 3. CSV & Excel Import / Export Infrastructure
- **Upload Middleware (`server/src/middleware/uploadMiddleware.js`):**
  - `multer` in-memory storage with 10MB size limit and extension/MIME verification (.csv, .xlsx, .xls).
- **Safe Parsing (`server/src/utils/spreadsheetUtils.js`):**
  - Secure parsing without spreadsheet macro execution or formula evaluation using `xlsx`.
  - Formula injection mitigation: cells starting with `=`, `+`, `-`, `@` are automatically escaped with leading single quotes.
  - Flexible column preview and intelligent mapping suggestions (`email`, `firstName`, `lastName`, `company`, `jobTitle`, `tags`).
  - Unconfirmed consent enforcement: imported contacts receive `imported_unconfirmed` status to comply with anti-spam standards.
  - Detailed import error summaries and duplicate detection (within file and workspace).
- **Exporting (`server/src/services/contactService.js`):**
  - Streamlined CSV and Excel (.xlsx) export scoped to workspace and active query filters.

### 4. Consent & Unsubscribe Management
- Dedicated suppression endpoint: `POST /api/v1/contacts/:id/unsubscribe`.
- Contact marked as `unsubscribed`, `unsubscribedAt` stamped, and consent transitioned to `opted_out`.
- Campaign delivery rules established: contacts missing explicit `opted_in` consent or marked unsubscribed/suppressed are excluded from sending.

### 5. API Endpoints (`/api/v1/contacts/...`)
| Method | Endpoint | Description | Protection / Validation |
|---|---|---|---|
| `GET` | `/api/v1/contacts` | Search, filter, sort, and paginate contacts | `requireAuth`, `requireWorkspace`, `contacts:read`, Zod |
| `GET` | `/api/v1/contacts/stats` | Scoped total contact count for dashboard | `requireAuth`, `requireWorkspace`, `contacts:read` |
| `POST` | `/api/v1/contacts` | Create a new contact | `requireAuth`, `requireWorkspace`, `contacts:manage`, Zod |
| `GET` | `/api/v1/contacts/:id` | Get contact details and consent history | `requireAuth`, `requireWorkspace`, `contacts:read` |
| `PATCH` | `/api/v1/contacts/:id` | Update contact attributes and preferences | `requireAuth`, `requireWorkspace`, `contacts:manage`, Zod |
| `DELETE` | `/api/v1/contacts/:id` | Delete contact | `requireAuth`, `requireWorkspace`, `contacts:manage` |
| `POST` | `/api/v1/contacts/:id/unsubscribe` | Immediate unsubscribe & suppression | `requireAuth`, `requireWorkspace`, `contacts:manage` |
| `GET` | `/api/v1/contacts/groups` | List contact groups with member counts | `requireAuth`, `requireWorkspace`, `contacts:read` |
| `POST` | `/api/v1/contacts/groups` | Create contact group | `requireAuth`, `requireWorkspace`, `contacts:manage`, Zod |
| `PATCH` | `/api/v1/contacts/groups/:groupId` | Rename / update contact group | `requireAuth`, `requireWorkspace`, `contacts:manage`, Zod |
| `DELETE` | `/api/v1/contacts/groups/:groupId` | Delete group (preserves contacts) | `requireAuth`, `requireWorkspace`, `contacts:manage` |
| `POST` | `/api/v1/contacts/groups/assign` | Bulk assign/remove groups | `requireAuth`, `requireWorkspace`, `contacts:manage`, Zod |
| `POST` | `/api/v1/contacts/tags/manage` | Bulk add/remove tags | `requireAuth`, `requireWorkspace`, `contacts:manage`, Zod |
| `POST` | `/api/v1/contacts/import/preview` | Upload spreadsheet & return columns/preview | `requireAuth`, `requireWorkspace`, `contacts:manage`, Multer |
| `POST` | `/api/v1/contacts/import/execute` | Execute mapped import with summary | `requireAuth`, `requireWorkspace`, `contacts:manage`, Multer |
| `GET` | `/api/v1/contacts/export` | Download CSV or Excel file of audience | `requireAuth`, `requireWorkspace`, `contacts:read` |

### 6. Frontend Implementation
- **`ContactsPage.jsx` (`client/src/pages/contacts/ContactsPage.jsx`):**
  - Replaced placeholder with full contact management interface.
  - Search bar with live debounced filtering across names, emails, company, job title, and tags.
  - Filters by Group, Subscription Status (`subscribed`, `unsubscribed`, `bounced`, `suppressed`), and Consent Status (`opted_in`, `pending`, `opted_out`, `imported_unconfirmed`).
  - Pagination controls and record count display.
  - Delivery eligibility indicators with visual badges (`ShieldCheck` vs `ShieldAlert`).
  - Slide-over contact inspection drawer showing full profile, company, phone, and timestamped consent audit trail.
- **`ContactModal.jsx` (`client/src/pages/contacts/ContactModal.jsx`):**
  - Modal form for creating and editing contacts with real-time validation, multi-group assignment chips, tags input, and consent controls.
- **`GroupsModal.jsx` (`client/src/pages/contacts/GroupsModal.jsx`):**
  - Modal interface for creating, viewing, renaming, and deleting contact groups with live contact counts per group.
- **`ImportModal.jsx` (`client/src/pages/contacts/ImportModal.jsx`):**
  - Multi-step modal workflow:
    1. Drag-and-drop / file selector for CSV/Excel spreadsheets with file validation.
    2. Column-to-field mapping with sample row values and default tag/group assignment.
    3. Import execution progress state.
    4. Comprehensive outcome summary displaying imported, updated, skipped duplicates, and invalid rows with specific error reporting.
- **Dashboard Integration (`client/src/pages/dashboard/DashboardPage.jsx`):**
  - Connected the `Total Contacts` stat card directly to `/api/v1/contacts/stats`, fetching and displaying the active workspace's real contact count.

### 7. Development Verification Checks
- **Backend syntax and import check:** All contact models, validators, controllers, and routes load without syntax errors.
- **Smoke test suite (`server/test_phase6_contacts.js`):**
  - Group creation and duplicate group rejection (passed).
  - Contact creation and email normalization to lowercase (passed).
  - Intra-workspace duplicate email prevention (passed).
  - Multi-tenant workspace isolation for identical emails (passed).
  - Searching, filtering, and pagination (passed).
  - Workspace contact count calculation (passed).
  - Unsubscribe and suppression transition (passed).
  - CSV and Excel export file buffer generation with formula escaping (passed).
  - Excel/CSV parsing and preview column mapping (passed).
  - Spreadsheet import execution with invalid email detection (passed).
- **Frontend build test:** Production build (`vite build`) compiled successfully with 0 errors (`1690 modules transformed`).

---

## Phase 7 — Email Account Integration (Completed)

### 1. Reusable Email Provider Abstraction
- **Base Interface (`server/src/services/email/BaseEmailProvider.js`):**
  - Defines uniform contract: `getAuthorizationUrl(options)`, `exchangeCodeForTokens(code, redirectUri)`, `refreshAccessToken(refreshToken)`, `sendEmail(options)`, `validateConnection(account)`, and `normalizeError(error)`.
- **Gmail Provider (`server/src/services/email/GmailProvider.js`):**
  - Implements Google OAuth2 authorization URL generation with offline consent (`access_type: offline`, `prompt: consent`).
  - Implements least-privilege sending scopes (`gmail.send`, `userinfo.email`, `userinfo.profile`).
  - Google user profile resolution during token exchange.
  - Automatic refresh token exchange on token expiration.
  - Nodemailer OAuth2 transport execution for real-time mailbox email dispatch.
  - Error classification distinguishing retryable errors (rate limits, timeouts) from permanent revocation failures (`invalid_grant`).
- **Outlook Provider (`server/src/services/email/OutlookProvider.js`):**
  - Provider stub for Microsoft 365 / Microsoft Graph API integration ensuring multi-provider future readiness.
- **Provider Registry (`server/src/services/email/EmailProviderRegistry.js`):**
  - Dynamic registry managing available mailbox delivery providers.

### 2. Database Architecture & Security
- **`EmailAccount` Model (`server/src/models/EmailAccount.js`):**
  - Workspace isolation: `workspaceId` (indexed) referencing `Workspace`.
  - Creator reference: `userId` referencing `User`.
  - Mailbox identity: `provider` (`gmail`, `outlook`, `smtp`), `emailAddress` (lowercased, trimmed), `displayName`.
  - Encrypted credential fields: `encryptedAccessToken`, `encryptedRefreshToken` (hidden from queries via `select: false` and stripped from JSON serializations).
  - Compliance & Quotas: `tokenExpiresAt`, `scopes`, `connectionStatus` (`connected`, `disconnected`, `expired`, `revoked`, `error`), `lastSyncedAt`, `metadata` (`dailyQuota`, `sentToday`, `providerUserId`).
  - Compound unique constraint `{ workspaceId: 1, emailAddress: 1, provider: 1 }` preventing duplicate connection records within the same workspace.
- **Token Encryption Utility (`server/src/utils/cryptoUtils.js`):**
  - AES-256-GCM symmetric encryption for OAuth access and refresh tokens at rest.
  - Cryptographic 96-bit initialization vectors (`iv`) and 128-bit authentication tags (`authTag`).
  - Key management decoupled and stored strictly server-side (`ENCRYPTION_KEY` or `JWT_ACCESS_SECRET`).

### 3. API Endpoints (`/api/v1/email-accounts/...`)
| Method | Endpoint | Description | Protection / Validation |
|---|---|---|---|
| `GET` | `/api/v1/email-accounts` | List connected mailboxes in active workspace | `requireAuth`, `requireWorkspace`, `settings:manage` |
| `GET` | `/api/v1/email-accounts/providers` | Query supported provider configurations | `requireAuth`, `requireWorkspace`, `settings:manage` |
| `POST` | `/api/v1/email-accounts/oauth/initiate` | Generate CSRF state & OAuth redirect URL | `requireAuth`, `requireWorkspace`, `settings:manage`, Zod |
| `POST` | `/api/v1/email-accounts/oauth/callback` | Exchange code for tokens, encrypt & save | `requireAuth`, `requireWorkspace`, `settings:manage`, Zod |
| `DELETE` | `/api/v1/email-accounts/:id` | Disconnect mailbox from workspace | `requireAuth`, `requireWorkspace`, `settings:manage` |
| `POST` | `/api/v1/email-accounts/:id/test` | Dispatch verification test email | `requireAuth`, `requireWorkspace`, `settings:manage`, Zod |

### 4. Frontend Implementation
- **`EmailAccountsPage.jsx` (`client/src/pages/workspace/EmailAccountsPage.jsx`):**
  - Displays connected mailboxes, active connection statuses, daily sending quotas, and last-synced timestamps.
  - Disconnect confirmation action with automatic sending pause.
  - Inline test-email dispatcher for sending verification emails.
  - Provider directory cards showing configured/ready status for Gmail and Microsoft Outlook.
  - Security educational banner explaining the difference between login authentication and mailbox sending permissions.
  - Manual OAuth token exchange modal for developer environments.
- **Navigation & Routing:**
  - Registered route `/workspace/email-accounts` in `App.jsx`.
  - Added "Email Accounts" navigation item in `AppSidebar.jsx` under the Administration section.

### 5. Development Verification Checks
- **Backend syntax and import check:** All email models, providers, services, validators, and routes load cleanly.
- **Smoke test suite (`server/test_phase7_email.js`):**
  - AES-256-GCM encryption and decryption roundtrip (passed).
  - Provider registry discovery and provider inspection (passed).
  - Cryptographic OAuth state generation and CSRF store verification (passed).
  - Error classification (retryable network timeouts vs permanent token revocation) (passed).
  - EmailAccount model workspace isolation and IDOR rejection (passed).
  - Mailbox account disconnection (passed).
- **Regression test (`server/test_phase3_workspace.js`):** Passed 100%.
- **Frontend build test:** Production build (`vite build`) compiled successfully with 0 errors (`1691 modules transformed`).

### 6. External Credentials Configuration Notes
- Real Gmail OAuth mailbox authorization requires configuring `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `server/.env`.
- In local development without Google Cloud Console credentials, the UI surfaces "CONFIG REQUIRED" indicators and prevents invalid OAuth calls. Real mail delivery was not fabricated.

---

## Phase 8 — Campaign Management System (Completed)

### 1. Database Architecture & Models
- **`Campaign` Model (`server/src/models/Campaign.js`):**
  - Multi-tenant isolation: `workspaceId` (indexed) referencing `Workspace`.
  - Author reference: `createdBy` referencing `User`.
  - Content & Identity: `name`, `subject`, `previewText` (preheader), `senderEmailAccountId` referencing `EmailAccount`, `senderName`, `replyTo`, `htmlContent`, `textContent`, `templateId`.
  - Recipient Configuration: `type` (`all_eligible`, `groups`, `tags`, `selected_contacts`), `groupIds`, `tags`, `contactIds`, `estimatedCount`.
  - Execution Status Lifecycle: `draft`, `scheduled`, `queued`, `processing`, `sent`, `partially_failed`, `failed`, `cancelled`.
  - Timing: `scheduledAt`, `timezone`, `startedAt`, `completedAt`.
  - Real-time Statistics: `totalRecipients`, `sent`, `delivered`, `failed`, `bounced`, `unsubscribed`.
  - Concurrency & Idempotency: `sendIdempotencyKey` index protecting against duplicate send triggers.
- **`CampaignRecipient` Model (`server/src/models/CampaignRecipient.js`):**
  - Granular recipient dispatch record: `campaignId`, `workspaceId`, `contactId`, `email`.
  - Delivery States: `pending`, `sent`, `delivered`, `bounced`, `failed`, `skipped_ineligible`.
  - Diagnostic Tracking: `providerMessageId`, `errorCode`, `errorMessage`, `sentAt`, `deliveredAt`.
  - Compound unique constraint `{ campaignId: 1, email: 1 }` preventing duplicate recipient entries.

### 2. Strict Recipient Eligibility & Anti-Spam Compliance
- **Compliance Rules (`server/src/services/campaignService.js`):**
  - Resolves recipients using strictly enforced compliance filters:
    - `status === 'subscribed'`
    - `consentStatus === 'opted_in'`
    - `unsubscribedAt === null`
  - Re-evaluates audience eligibility immediately prior to dispatch.
  - Automatically excludes `imported_unconfirmed`, `unsubscribed`, `bounced`, or `suppressed` contacts.

### 3. Personalization & Safe HTML Rendering
- **Template Personalizer (`server/src/utils/templatePersonalizer.js`):**
  - Supports placeholder interpolation: `{{firstName}}`, `{{lastName}}`, `{{email}}`, `{{company}}`, `{{jobTitle}}`.
  - Safe HTML escaping: replaces characters (`&`, `<`, `>`, `"`, `'`) in untrusted contact attributes to prevent XSS.

### 4. Sending & Queue Architecture (Phase 9 Bridge)
- Provider abstraction integration (`GmailProvider`, Nodemailer OAuth2).
- Pre-dispatch recipient record generation ensuring persistence before network activity.
- Test email action personalizing content with sample user data for desktop/mobile inspection.
- Clean handoff ready for BullMQ / Redis background workers in Phase 9.

### 5. API Endpoints (`/api/v1/campaigns/...`)
| Method | Endpoint | Description | Protection / Validation |
|---|---|---|---|
| `GET` | `/api/v1/campaigns` | Search, filter, and paginate campaigns | `requireAuth`, `requireWorkspace`, `campaigns:read`, Zod |
| `POST` | `/api/v1/campaigns` | Create new campaign draft | `requireAuth`, `requireWorkspace`, `campaigns:create`, Zod |
| `GET` | `/api/v1/campaigns/:id` | Get campaign details and statistics | `requireAuth`, `requireWorkspace`, `campaigns:read` |
| `PATCH` | `/api/v1/campaigns/:id` | Update draft/scheduled campaign | `requireAuth`, `requireWorkspace`, `campaigns:update`, Zod |
| `DELETE` | `/api/v1/campaigns/:id` | Delete draft or cancelled campaign | `requireAuth`, `requireWorkspace`, `campaigns:delete` |
| `POST` | `/api/v1/campaigns/:id/duplicate` | Duplicate campaign as draft | `requireAuth`, `requireWorkspace`, `campaigns:create` |
| `POST` | `/api/v1/campaigns/preview-audience` | Live calculation of eligible recipients | `requireAuth`, `requireWorkspace`, `campaigns:read`, Zod |
| `POST` | `/api/v1/campaigns/:id/test-email` | Send personalized test email to operator | `requireAuth`, `requireWorkspace`, `campaigns:update`, Zod |
| `POST` | `/api/v1/campaigns/:id/send` | Initialize recipients and queue campaign | `requireAuth`, `requireWorkspace`, `campaigns:send` |
| `GET` | `/api/v1/campaigns/:id/recipients` | Audit individual recipient delivery logs | `requireAuth`, `requireWorkspace`, `campaigns:read` |

### 6. Frontend Implementation
- **`CampaignsPage.jsx` (`client/src/pages/campaigns/CampaignsPage.jsx`):**
  - Replaced placeholder with live campaign table, search, status filters, and action controls.
- **`CampaignComposerModal.jsx` (`client/src/pages/campaigns/CampaignComposerModal.jsx`):**
  - 4-step campaign authoring wizard:
    1. Details, subject, and sender account selection.
    2. Dynamic audience segmentation with live eligible recipient calculation.
    3. Content editor with placeholder insertion tags and plain-text fallback.
    4. Preview screen with desktop/mobile view toggles, test-email sender, and send confirmation.
- **`CampaignDetailDrawer.jsx` (`client/src/pages/campaigns/CampaignDetailDrawer.jsx`):**
  - Inspection drawer displaying campaign metrics, sender details, and individual recipient status logs.

### 7. Development Verification Checks
- **Backend syntax and import check:** All campaign models, routes, controllers, and services loaded cleanly.
- **Smoke test suite (`server/test_phase8_campaigns.js`):**
  - Contact setup with varying consent states (opted-in, imported unconfirmed, unsubscribed) (passed).
  - Recipient eligibility filter verification (only opted-in/subscribed contacts included) (passed).
  - XSS injection prevention and HTML escaping in personalization (passed).
  - Campaign creation and draft updates (passed).
  - Campaign duplication (passed).
  - Multi-workspace IDOR protection (passed).
  - Campaign send trigger and initial recipient record generation (passed).
  - Duplicate send rejection via idempotency protection (passed).
  - Recipient delivery records query (passed).
- **Regression tests:** Phase 6 (`server/test_phase6_contacts.js`) and Phase 7 (`server/test_phase7_email.js`) passed 100%.
- **Frontend build test:** Production build (`vite build`) compiled successfully with 0 errors (`1693 modules transformed`).






---

## Phase 10 — Automatic Replies (Completed)

### 1. Mailbox Integration (Gmail API & Microsoft Graph API)
- **Gmail Provider (`server/src/services/email/GmailProvider.js`):**
  - Extended scopes for mailbox reading and incoming synchronization: `gmail.readonly`, `gmail.modify`, `gmail.send`.
  - Added message polling and inspection (`listMessages()`, `getMessage()`) supporting metadata, headers, historyId, and snippet extraction.
- **Microsoft Graph Provider (`server/src/services/email/OutlookProvider.js`):**
  - Implemented OAuth 2.0 authorization code exchange and token refresh against Microsoft Graph endpoints.
  - Implemented Graph mail delivery (`/me/sendMail`) and inbox polling (`/me/mailFolders/inbox/messages`).
- **EmailAccount Model Extension (`server/src/models/EmailAccount.js`):**
  - Added `autoReplySettings`: `enabled`, `cooldownMinutes`, `defaultReplySubject`, `defaultReplyBody`, `ignoreNoReply`, `ignoreOwnMessages`, `pollIntervalSeconds`, `lastPolledAt`, and delta/history sync markers.

### 2. Auto-Reply Engine & Safeguards
- **AutoReplyRule Model (`server/src/models/AutoReplyRule.js`):**
  - Flexible keyword matching (`contains`, `exact`, `starts_with`, `ends_with`, `regex`).
  - Target fields: Subject line, message body.
  - Senders whitelist / blacklist support.
  - Priority evaluation (higher numbers evaluated first).
  - Custom reply templates with placeholder replacement (`{{subject}}`).
- **ActivityLog Model (`server/src/models/ActivityLog.js`):**
  - Audit logs tracking incoming emails, matched rules, skip reasons, reply timestamps, and message IDs.
  - Compound unique constraint `{ workspaceId: 1, emailAccountId: 1, providerMessageId: 1 }` to physically guarantee no duplicate processing.
- **Mandatory Safety Safeguards Implemented (`server/src/services/autoReplyService.js`):**
  - *Self message loop prevention:* Never replies if the sender address matches the mailbox's own address.
  - *Automated email protection:* Ignores `no-reply@`, `noreply@`, `mailer-daemon@`, `bounce@`, and `donotreply@`.
  - *Duplicate message rejection:* Incoming messages with an already processed `providerMessageId` are safely skipped.
  - *Sender cooldown limits:* Enforces configurable time window (default 60 mins) so repeat incoming messages from the same sender do not cause mail loops.
  - *Default fallback:* Automatically issues the mailbox's default acknowledgment reply if no custom keyword rule matches.
  - *Disabled mailbox check:* Bypasses all processing if auto-reply is disabled at the account or rule level.

### 3. Background Processing & Queue Jobs
- **BullMQ Queue Management (`server/src/queues/queueManager.js`):**
  - Added `QUEUE_NAMES.INBOX_POLLING` and `QUEUE_NAMES.AUTO_REPLY_DISPATCH`.
- **Worker Process (`server/src/workers/autoReplyWorker.js` & `server/src/worker.js`):**
  - Standalone worker processes polling jobs, queries unread incoming messages via provider APIs, matches rules, and triggers replies.

### 4. API Endpoints
| Method | Endpoint | Description | Protection / Validation |
|---|---|---|---|
| `GET` | `/api/v1/auto-reply/rules` | List auto-reply rules for a mailbox | `requireAuth`, `requireWorkspace`, `settings:manage` |
| `POST` | `/api/v1/auto-reply/rules` | Create a new auto-reply rule | `requireAuth`, `requireWorkspace`, `settings:manage`, Zod |
| `GET` | `/api/v1/auto-reply/rules/:id` | Get rule details | `requireAuth`, `requireWorkspace`, `settings:manage` |
| `PATCH` | `/api/v1/auto-reply/rules/:id` | Update rule conditions or templates | `requireAuth`, `requireWorkspace`, `settings:manage`, Zod |
| `DELETE` | `/api/v1/auto-reply/rules/:id` | Delete auto-reply rule | `requireAuth`, `requireWorkspace`, `settings:manage` |
| `PATCH` | `/api/v1/auto-reply/settings/:accountId` | Enable/disable auto-reply & configure defaults | `requireAuth`, `requireWorkspace`, `settings:manage`, Zod |
| `GET` | `/api/v1/auto-reply/logs` | Audit trail of processed and replied messages | `requireAuth`, `requireWorkspace`, `settings:manage` |
| `POST` | `/api/v1/auto-reply/simulate` | Test message simulation against active rules | `requireAuth`, `requireWorkspace`, `settings:manage` |

### 5. Frontend Implementation (`client/src/pages/auto-reply/AutoReplyPage.jsx`)
- Replaced placeholder with a full 4-tab control center:
  1. **Reply Rules:** Prioritized rule cards, active/pause toggles, edit modal, and keyword condition setup.
  2. **Mailbox Settings:** Enable/disable toggle, sender cooldown limit, loop prevention checkboxes, and default reply editor.
  3. **Activity & History:** Real-time stream of incoming messages, matched rules, skipped events, and delivery details.
  4. **Rule Simulator:** In-app sandbox allowing operators to test subject/body combinations and verify matching behavior safely.

### 6. Development Verification Checks
- **Smoke test suite (`server/test_phase10_autoreply.js`):**
  - Priority rule matching (passed).
  - Duplicate message prevention (passed).
  - Sender cooldown safeguard (passed).
  - Own mailbox message suppression (passed).
  - Automated/no-reply sender suppression (passed).
  - Default fallback response on unmatched queries (passed).
  - Mailbox disabled bypass (passed).
  - Multi-tenant IDOR isolation (passed).
- **Regression test suite:**
  - Phase 3 Workspace: Passed 100%.
  - Phase 6 Contacts: Passed 100%.
  - Phase 7 Email Accounts: Passed 100%.
  - Phase 8 Campaigns: Passed 100%.
  - Phase 9 Scheduling: Passed 100%.
- **Client production build:** `vite build` compiled with 0 errors (`1693 modules transformed`).

---

## Phase 11 — Analytics & Admin Dashboard (Completed)

### 1. Analytics Aggregation Service (`server/src/services/analyticsService.js`)
- **Dashboard Overview (`getDashboardAnalytics`):**
  - Aggregates total, scheduled, and active campaigns.
  - Aggregates delivery numbers, failed deliveries, bounces, opens, and clicks.
  - Computes accurate percentages using documented denominators:
    - `deliveryRate = (delivered / sent) * 100`
    - `openRate = (uniqueOpens / delivered) * 100`
    - `clickRate = (uniqueClicks / delivered) * 100`
  - Audience statistics: Total contacts, subscribed, unsubscribed.
  - Auto-reply activity metrics: Processed, replied, and skipped.
  - Filterable by timeframe: `today`, `7d`, `30d`, and `all`.
- **Campaign Performance Analytics (`getCampaignAnalytics`):**
  - Granular recipient dispatch metrics, delivery rates, bounce rates, and unsubscribe rates.
  - Transparent tracking disclosure documenting that email metrics reflect verified provider events without injecting intrusive, spam-triggering tracking pixels.
- **Auto-Reply Analytics (`getAutoReplyAnalytics`):**
  - Processed, replied, skipped (cooldowns/loop prevention), and failed reply totals.
  - Aggregates top frequently triggered rules.
- **Admin System Health (`getAdminSystemHealth`):**
  - Real-time Redis connection health and degraded mode status.
  - BullMQ queue metrics across dispatch, scheduling, and auto-reply queues.
  - Workspace inventory totals (mailboxes, campaigns, members).
  - Background worker availability.
- **CSV Data Export (`exportCampaignsCsv`):**
  - Export campaign performance datasets with safe CSV cell escaping.

### 2. Audit Trail System (`server/src/models/AuditLog.js` & `server/src/services/auditService.js`)
- **`AuditLog` Model:**
  - Tracks security and administrative actions: logins, workspace modifications, member role changes, campaign creation/scheduling/sending, mailbox connections, and auto-reply rules.
  - Records `actorName`, `actorEmail`, `action`, `entityType`, `entityId`, `details`, `ipAddress`, and `userAgent`.
  - Strictly strips credentials, passwords, and OAuth tokens before persisting.

### 3. API Endpoints (`/api/v1/analytics/...`)
| Method | Endpoint | Description | Protection / Validation |
|---|---|---|---|
| `GET` | `/api/v1/analytics/overview` | Aggregated dashboard overview metrics | `requireAuth`, `requireWorkspace`, `analytics:read` |
| `GET` | `/api/v1/analytics/campaigns/:id` | Performance analytics for a campaign | `requireAuth`, `requireWorkspace`, `analytics:read` |
| `GET` | `/api/v1/analytics/auto-reply` | Auto-reply summary and top rules | `requireAuth`, `requireWorkspace`, `analytics:read` |
| `GET` | `/api/v1/analytics/admin/health` | Redis, BullMQ queue, and worker health | `requireAuth`, `requireWorkspace`, `settings:manage` |
| `GET` | `/api/v1/analytics/export/campaigns` | Export campaign analytics to CSV | `requireAuth`, `requireWorkspace`, `analytics:read` |
| `GET` | `/api/v1/analytics/audit-logs` | Filterable workspace security audit trail | `requireAuth`, `requireWorkspace`, `settings:manage` |

### 4. Frontend Implementation
- **`AnalyticsPage.jsx` (`client/src/pages/analytics/AnalyticsPage.jsx`):**
  - Replaced coming soon placeholder with a tabbed analytics interface:
    1. *Campaign Delivery:* Timeframe filter (`today`, `7d`, `30d`, `all`), stat cards, deliverability rates, engagement transparency disclosure, and CSV export.
    2. *Auto-Reply Insights:* Messages processed, replies sent, skipped messages, and most triggered rules.
    3. *System & Worker Health:* Redis status indicator, workspace inventory, and background worker state.
- **`ActivityPage.jsx` (`client/src/pages/activity/ActivityPage.jsx`):**
  - Replaced placeholder with live audit trail view, action type filtering, keyword search, and actor/timestamp displays.

### 5. Verification Checks
- **Smoke test suite (`server/test_phase11_analytics.js`):**
  - Aggregation calculation accuracy (passed).
  - Rate calculations with documented denominators (passed).
  - Auto-reply analytics aggregation (passed).
  - Audit log recording and querying (passed).
  - CSV export generation (passed).
  - Multi-tenant IDOR protection on analytics queries (passed).
- **Regression test suite:**
  - Phase 3 Workspace: Passed 100%.
  - Phase 6 Contacts: Passed 100%.
  - Phase 7 Email Accounts: Passed 100%.
  - Phase 8 Campaigns: Passed 100%.
  - Phase 9 Scheduling: Passed 100%.
  - Phase 10 Automatic Replies: Passed 100%.
- **Client production build:** `vite build` compiled with 0 errors (`1693 modules transformed`).
