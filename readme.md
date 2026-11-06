# MailFlow --- Complete Project Requirements, Workflow & Development Process

**Project type:** Multi-user SaaS application\
**Project title:** MailFlow --- Smart Bulk Email, Campaign Automation &
AI Assistant Platform\
**Architecture:** MERN-based full-stack application with background
workers and external integrations\
**Document purpose:** Product requirements, system workflows, technical
architecture, implementation roadmap, testing strategy, and deployment
plan\
**Specification status:** Consolidated project baseline

------------------------------------------------------------------------

## 1. Executive Summary

MailFlow is a multi-user email campaign and automation platform. Any
eligible person can register, verify their account, sign in, create a
private workspace, connect a supported email account, manage contacts,
compose and schedule campaigns, configure automatic replies, and review
campaign analytics.

The application also includes:

-   A first-login interactive onboarding tutorial.
-   An AI-powered in-app assistant.
-   Transactional emails for account and security events.
-   User and administrator notifications.
-   An administrator console with role-based permissions.
-   Background processing for scheduled and bulk email jobs.
-   Cloud deployment and operational monitoring.

The system must isolate each user's data. A user must not be able to
access another user's contacts, campaigns, mailbox credentials, reports,
settings, or chatbot conversations.

### 1.1 Product goals

1.  Provide an approachable interface for managing email campaigns.
2.  Support multiple independent users and workspaces.
3.  Make campaign sending and scheduling reliable through background
    processing.
4.  Provide secure account management and email integrations.
5.  Help new users learn the application through guided onboarding.
6.  Provide AI assistance for application help and email drafting.
7.  Give administrators the tools needed to monitor and manage the
    platform.
8.  Keep the architecture extensible so additional email providers and
    capabilities can be added later.

### 1.2 Initial release boundaries

The first release should prioritize the core multi-user workflow,
Gmail-based sending, contact management, campaigns, scheduling,
onboarding, administration, and essential AI assistance.

Outlook mailbox integration, advanced recurring automation, detailed
engagement tracking, advanced AI actions, billing, and additional email
providers can be introduced in later releases without changing the core
architecture.

------------------------------------------------------------------------

## 2. Product Model and User Types

### 2.1 Application model

MailFlow will be built as a **multi-user SaaS-style application with
public registration**.

-   Anyone can create a standard user account.
-   Email verification is required before normal account use.
-   A workspace is created for each user during onboarding or account
    setup.
-   Each workspace owns its contacts, campaigns, templates, connected
    mailboxes, automation rules, and relevant records.
-   Platform administration is separate from ordinary user workspaces.
-   Users cannot self-assign administrator privileges.

### 2.2 Roles

  -----------------------------------------------------------------------
  Role                                Responsibilities
  ----------------------------------- -----------------------------------
  Super Admin                         Full platform administration and
                                      role governance

  Admin                               Manage users and operational
                                      settings within assigned
                                      permissions

  Campaign Manager                    Manage campaigns and contacts in an
                                      authorized workspace

  User                                Manage their own workspace and
                                      resources
  -----------------------------------------------------------------------

The initial public registration flow assigns the `user` role only.
Administrative roles must be granted through a protected administrative
process.

### 2.3 Workspace isolation

Every workspace-owned record must be associated with a trusted workspace
identifier. The backend must derive or validate workspace access from
the authenticated identity and authorization rules. It must never trust
a workspace ID supplied by the browser without checking access.

Examples of workspace-owned data:

-   Contacts and contact groups
-   Campaigns and recipient records
-   Email templates
-   Connected email accounts
-   Auto-reply rules
-   User notifications
-   Chat conversations
-   Workspace settings and reports

------------------------------------------------------------------------

## 3. Technology Stack

  -----------------------------------------------------------------------
  Layer                   Technology              Responsibility
  ----------------------- ----------------------- -----------------------
  Frontend                React + Vite            Single-page application

  Styling                 Tailwind CSS            Responsive design
                                                  system

  Backend runtime         Node.js                 Server runtime

  API framework           Express.js              REST API and middleware

  Database                MongoDB Atlas           Persistent application
                                                  data

  ODM                     Mongoose                MongoDB schemas and
                                                  queries

  Validation              Zod                     Request and
                                                  configuration
                                                  validation

  Password hashing        bcrypt                  Password hash
                                                  generation and
                                                  verification

  Authentication          JWT plus secure refresh API authentication
                          sessions                

  Social login            OAuth 2.0 / OpenID      Google, GitHub,
                          Connect                 Microsoft sign-in

  SMTP sending            Nodemailer              Initial Gmail SMTP
                                                  sending integration

  Gmail mailbox           Gmail API               Incoming email and
                                                  mailbox operations

  Outlook mailbox         Microsoft Graph         Outlook mailbox
                                                  integration

  Queue                   BullMQ                  Background job
                                                  processing

  Queue storage           Redis                   Persistent queue state
                                                  and delayed jobs

  AI assistant            Server-side LLM API     Chatbot and email
                          integration             drafting

  Charts                  Recharts                Analytics visualization

  Unit/integration tests  Vitest                  Automated tests

  End-to-end tests        Playwright              Browser workflow tests

  API validation          Postman                 Manual API testing

  Version control         Git + GitHub            Source control and
                                                  collaboration
  -----------------------------------------------------------------------

### 3.1 Provider abstraction

Email sending and mailbox operations should be behind service
interfaces. Campaign logic should not depend directly on Gmail-specific
implementation details. This makes it possible to add a dedicated
transactional or bulk email provider later.

### 3.2 Environment configuration

Secrets must be stored in environment variables or a managed secret
store. Never commit secrets to Git or expose server credentials in
frontend code.

Example configuration names (values must be supplied securely):

``` env
NODE_ENV=
PORT=
MONGODB_URI=
REDIS_URL=
CLIENT_URL=
API_BASE_URL=

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=

MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_CALLBACK_URL=

GMAIL_SMTP_USER=
GMAIL_SMTP_APP_PASSWORD=

AI_PROVIDER=
AI_API_KEY=
AI_MODEL=
```

Use separate development, test, and production credentials. OAuth
callback URLs and allowed frontend origins must match the deployed
environments.

------------------------------------------------------------------------

## 4. High-Level System Architecture

### 4.1 Logical architecture

``` text
Browser / React + Vite
        |
        | HTTPS / REST API
        v
Express API Server
        |
        +---- Authentication and authorization
        |
        +---- Workspace and business services
        |
        +---- MongoDB Atlas
        |
        +---- AI Assistant Service ---- LLM Provider
        |
        +---- Email Provider Services
        |
        +---- BullMQ Queues
                    |
                    v
                  Redis
                    |
                    v
             Background Workers
                    |
                    +---- Nodemailer / SMTP
                    +---- Gmail API
                    +---- Microsoft Graph
                    +---- Notification processing
```

### 4.2 Responsibilities

**Frontend** - Render application pages and reusable components. -
Handle forms and client-side validation. - Display onboarding,
dashboard, campaign status, analytics, and chatbot. - Call authenticated
APIs. - Never make direct database or secret-bearing provider calls.

**API server** - Authenticate requests. - Enforce roles and workspace
ownership. - Validate inputs. - Execute business logic. - Persist
records. - Create background jobs. - Return consistent API responses.

**Database** - Persist users, workspaces, contacts, campaigns,
recipients, integrations, templates, notifications, logs, and
conversations.

**Queue and workers** - Process campaign recipient jobs. - Execute
delayed campaigns. - Send notifications. - Retry eligible failures with
limits. - Recover jobs after worker restarts.

**External providers** - Send email. - Receive mailbox
events/messages. - Provide AI responses. - Support OAuth identity and
mailbox permissions.

------------------------------------------------------------------------

## 5. Complete User Journey

### 5.1 Registration

1.  Visitor opens the MailFlow registration page.
2.  Enters name, email, password, and required policy consent.
3.  Frontend performs basic validation.
4.  Backend validates using Zod.
5.  Backend normalizes the email and checks for an existing account.
6.  Password is hashed with bcrypt.
7.  User is created with the default `user` role and unverified status.
8.  A cryptographically secure, expiring verification token is
    generated.
9.  Only a hash of the token is stored.
10. A verification email is queued and sent.
11. User sees a confirmation page explaining that verification is
    required.

Registration responses should avoid leaking sensitive account-existence
information where appropriate.

### 5.2 Email verification

1.  User clicks the verification link.
2.  Frontend sends the token to the backend.
3.  Backend hashes the submitted token and finds the matching record.
4.  Backend checks expiry and single-use status.
5.  Account is marked verified.
6.  Verification token is invalidated.
7.  Workspace creation is completed if it was not already created.
8.  Welcome email is queued.
9.  User can sign in.

Verification links must use the configured application origin, not an
untrusted Host header.

### 5.3 Login

Supported login methods:

-   Email and password
-   Google OAuth
-   GitHub OAuth
-   Microsoft OAuth

Login process:

1.  User submits credentials or starts an OAuth flow.
2.  Backend validates identity and account status.
3.  Backend issues a short-lived access token and establishes a secure
    refresh session.
4.  Refresh credentials should be stored in secure, HttpOnly,
    appropriately configured cookies where the architecture supports
    them.
5.  Backend resolves the user's role and workspace access.
6.  Backend returns the minimum profile and onboarding state required by
    the frontend.
7.  First-time users are routed to onboarding.
8.  Returning users go to the dashboard.

OAuth account linking must be explicit and secure. Do not automatically
link accounts solely because an unverified email string matches.

### 5.4 Forgot and reset password

1.  User submits an email address.
2.  API returns a generic response that does not disclose whether the
    account exists.
3.  For an eligible account, backend creates a random, expiring,
    single-use reset token.
4.  Only the token hash is persisted.
5.  Reset email is queued.
6.  User opens the reset link and submits a new password.
7.  Backend validates token, expiry, and single-use status.
8.  New password is hashed and stored.
9.  Reset token is invalidated.
10. Existing refresh sessions may be revoked.
11. Password-changed notification is queued.

Never email passwords or store raw reset tokens.

### 5.5 First-login onboarding

On a user's first verified login, show a welcome screen and guided
product tour.

Recommended tutorial steps:

1.  Welcome to MailFlow.
2.  Dashboard overview.
3.  Connect an email account.
4.  Add or import contacts.
5.  Create an email campaign.
6.  Preview and test an email.
7.  Schedule a campaign.
8.  Use templates and auto replies.
9.  Understand analytics.
10. Find settings, help, and the AI assistant.

Tutorial behavior:

-   Next and Previous controls.
-   Skip option.
-   Progress indicator.
-   Highlight the relevant page or control.
-   Contextual tooltips.
-   Optional try-it-yourself tasks.
-   Save progress on the server.
-   Resume after leaving or signing in on another device.
-   Restart from Help or Settings.
-   Admins receive an admin-oriented onboarding flow.

Suggested user fields:

``` js
{
  isVerified: false,
  onboardingCompleted: false,
  onboardingStep: 0,
  onboardingSkipped: false
}
```

The backend is the source of truth for onboarding status. Browser local
storage may be used for temporary UI state, but not as the authoritative
completion record.

------------------------------------------------------------------------

## 6. Dashboard and Navigation

### 6.1 Main navigation

1.  Dashboard
2.  Compose Email
3.  Contacts
4.  Campaigns
5.  Scheduled Emails
6.  Auto Reply
7.  Email Templates
8.  Analytics
9.  Activity Logs
10. Notifications
11. Settings
12. Help and AI Assistant

### 6.2 Dashboard overview

Show user-scoped data:

-   Total contacts
-   Total campaigns
-   Emails submitted to providers
-   Failed sending attempts
-   Scheduled campaigns
-   Provider-confirmed delivery metrics where available
-   Recent campaigns
-   Recent activity
-   Notifications
-   Quick actions

All metrics must be calculated from authorized database records. Do not
display fabricated statistics.

### 6.3 UI expectations

-   Responsive desktop, tablet, and mobile layouts.
-   Accessible forms and navigation.
-   Clear loading, empty, error, and success states.
-   Consistent confirmation dialogs for destructive actions.
-   Dark and light themes.
-   Pagination for large tables.
-   Search, filters, and sorting where appropriate.

------------------------------------------------------------------------

## 7. Contact Management Workflow

### 7.1 Contact creation

1.  User opens Contacts.
2.  Selects Add Contact.
3.  Enters name, email, and optional fields.
4.  Frontend validates required fields.
5.  Backend validates and normalizes the data.
6.  Backend checks duplicates within the workspace.
7.  Contact is saved with workspace ownership and consent/preferences
    fields.
8.  Activity is logged.

### 7.2 CSV and Excel import

1.  User selects Import.
2.  Uploads a supported CSV or Excel file.
3.  Backend checks file size, extension, MIME/type and parsing safety.
4.  User maps file columns to MailFlow fields if needed.
5.  Backend parses rows.
6.  Email values are normalized and validated.
7.  Duplicate and invalid rows are identified.
8.  User receives an import preview and summary.
9.  Valid rows are imported.
10. Import outcome is stored and displayed.

Do not execute macros or trust spreadsheet formulas. Apply upload limits
and safe parsing.

### 7.3 Contact features

-   Add, view, edit, and delete contacts.
-   CSV and Excel import/export.
-   Duplicate detection.
-   Search, filtering, sorting, and pagination.
-   Contact groups.
-   Segmentation.
-   Consent and marketing preference tracking.
-   Unsubscribe handling.
-   Suppression list management.

### 7.4 Recipient eligibility

Before a marketing campaign is queued and again before sending, verify
that each recipient is eligible. Exclude unsubscribed contacts,
suppressed addresses, invalid addresses, and contacts without the
required consent/legal basis.

------------------------------------------------------------------------

## 8. Email Account Integration

### 8.1 Initial provider

Start with Gmail SMTP through Nodemailer for controlled development and
initial sending.

### 8.2 Later providers

-   Gmail API for mailbox operations and incoming email.
-   Microsoft Graph for Outlook mailbox operations.
-   A dedicated email service provider for larger-scale marketing or
    transactional sending.

### 8.3 Mailbox connection workflow

1.  User opens Settings \> Email Accounts.
2.  Chooses Gmail or Outlook.
3.  Backend starts the appropriate OAuth authorization flow.
4.  User grants only the requested permissions.
5.  Provider redirects to the registered callback URL.
6.  Backend validates OAuth state and exchanges the authorization code.
7.  Tokens are encrypted at rest.
8.  Connected account metadata is saved against the workspace.
9.  UI displays connection status and granted capabilities.
10. User can disconnect or reauthorize the account.

Identity-provider login and mailbox authorization are separate features.
Logging in with Google does not automatically grant permission to send
or read mailbox messages.

### 8.4 Gmail SMTP considerations

Gmail SMTP may be suitable for development and small controlled usage,
subject to Google's account and sending limits. It is not an
unrestricted bulk marketing service. Production-scale sending should use
an appropriate provider with sending-domain authentication, bounce
handling, suppression support, and provider event webhooks.

------------------------------------------------------------------------

## 9. Bulk Email Campaign Workflow

### 9.1 Campaign creation

1.  User opens Compose Email.
2.  Selects a contact group, individual contacts, or an eligible
    imported list.
3.  Enters sender identity, subject, and email body.
4.  Uses rich-text/HTML editor if enabled.
5.  Adds supported attachments if needed.
6.  Optionally selects a saved template.
7.  Previews the message.
8.  Sends a test email.
9.  Saves as draft, sends immediately, or schedules.

### 9.2 Backend campaign validation

Before creating send jobs:

-   Authenticate user.
-   Resolve workspace from trusted identity.
-   Verify campaign permissions.
-   Validate subject and content.
-   Validate attachment limits and file safety.
-   Resolve recipients within authorized workspace.
-   Normalize and deduplicate recipient addresses.
-   Check consent, unsubscribe, and suppression status.
-   Enforce provider and workspace sending quotas.
-   Confirm a valid sending account is configured.

### 9.3 Persistence model

Create a campaign record and individual recipient records.
Recipient-level records are necessary for tracking, retries, and
accurate reporting.

Suggested campaign fields:

-   workspaceId
-   createdBy
-   name
-   subject
-   content
-   templateId (optional)
-   sendingAccountId
-   status
-   scheduledAt
-   timezone
-   totalRecipients
-   processedCount
-   acceptedCount
-   failedCount
-   createdAt
-   updatedAt

Suggested recipient fields:

-   workspaceId
-   campaignId
-   contactId (optional)
-   normalizedEmail
-   status
-   attempts
-   providerMessageId (if available)
-   lastErrorCode
-   submittedAt
-   deliveredAt (only when provider confirms)
-   bouncedAt (only when provider confirms)

### 9.4 Campaign sending

1.  Campaign is persisted.
2.  Eligible recipient records are created.
3.  Jobs are enqueued with unique idempotency identifiers.
4.  Worker obtains a job.
5.  Worker rechecks campaign state, recipient eligibility, and sending
    limits.
6.  Worker sends through the configured provider.
7.  Worker stores the provider response and recipient status.
8.  Retryable failures are retried within configured limits.
9.  Permanent failures are recorded without endless retries.
10. Campaign aggregate status is recalculated.
11. User is notified when processing completes.

### 9.5 Campaign statuses

Recommended lifecycle:

-   Draft
-   Scheduled
-   Queued
-   Processing
-   Sent (all eligible sends accepted by provider)
-   Partially Failed
-   Failed
-   Cancelled

Use precise status labels. A provider accepting an SMTP/API request is
not proof of inbox delivery.

### 9.6 Campaign controls

-   Save draft.
-   Edit draft.
-   Duplicate campaign.
-   Preview.
-   Send test.
-   Send now.
-   Schedule.
-   Cancel before processing where possible.
-   View recipient results.
-   Retry eligible failures under controlled rules.
-   Export campaign report.

------------------------------------------------------------------------

## 10. Scheduling and Background Processing

### 10.1 Technology

Use BullMQ and Redis for persistent background jobs. Avoid relying on
in-memory timers or a basic cron-only approach for critical campaign
scheduling.

### 10.2 Scheduling workflow

1.  User composes a campaign.
2.  Chooses Schedule Later.
3.  Selects date, time, and timezone.
4.  Backend validates that the schedule is acceptable.
5.  Campaign is saved with Scheduled status.
6.  A delayed BullMQ job is created.
7.  Redis stores queue state.
8.  Worker runs when the delayed job becomes eligible.
9.  Worker checks cancellation and recipient eligibility.
10. Campaign recipient jobs are processed.
11. Status and results are persisted.
12. Completion notification is generated.

### 10.3 Reliability requirements

-   Retry with exponential backoff for transient errors.
-   Maximum retry count.
-   Unique job identifiers/idempotency.
-   Duplicate-send mitigation.
-   Queue monitoring.
-   Failed-job visibility.
-   Worker health checks.
-   Recovery after restarts.
-   Cancellation handling.
-   Timezone-aware scheduling.
-   Rate limiting and concurrency controls.

Exactly-once delivery cannot be guaranteed by a queue alone. If a
provider accepts a message but the worker crashes before persisting the
response, the system may face an ambiguous outcome. Design
provider-aware idempotency where supported and record ambiguous outcomes
for safe reconciliation rather than blindly resending.

Production scheduling requires a continuously available worker and
dependable Redis service. Sleeping/free compute services are not
suitable for precise time-critical scheduling.

------------------------------------------------------------------------

## 11. Automatic Reply Workflow

### 11.1 Purpose

Automatic replies process incoming email messages and send configured
responses. This is distinct from bulk campaign sending.

### 11.2 Workflow

1.  User connects a Gmail or Outlook mailbox with appropriate
    permissions.
2.  User enables Auto Reply.
3.  User creates rules and selects templates.
4.  Incoming messages are detected through Gmail push notifications or
    polling, or Microsoft Graph subscriptions/polling.
5.  Backend validates the mailbox event and message.
6.  Message is normalized into a provider-independent format.
7.  Backend checks sender, thread, rule conditions, and prior replies.
8.  Matching rule is selected.
9.  Reply template is rendered.
10. Loop-prevention and duplicate checks run.
11. Reply is sent through the connected mailbox.
12. Incoming and outgoing events are recorded.
13. User can review the automation history.

### 11.3 Example rules

  Incoming condition   Action
  -------------------- -----------------------------
  Contains "pricing"   Send pricing information
  Contains "support"   Send support acknowledgment
  Contains "meeting"   Send meeting information
  General inquiry      Send default acknowledgment

### 11.4 Safeguards

-   Do not reply to the application's own messages.
-   Avoid replying to automated/bounce messages.
-   Prevent repeated replies to the same thread or message.
-   Avoid loops between auto responders.
-   Respect mailbox permissions and user enable/disable settings.
-   Provide a pause/disable control.
-   Record rule execution and failures.

Nodemailer sends email; it does not independently monitor incoming inbox
messages. Gmail API or Microsoft Graph is required for mailbox
monitoring.

------------------------------------------------------------------------

## 12. Email Templates

### 12.1 Template categories

-   Welcome messages.
-   Product announcements.
-   Promotions.
-   Event invitations.
-   Customer support responses.
-   Business notifications.
-   Automatic replies.

### 12.2 Template workflow

1.  User opens Email Templates.
2.  Creates a template.
3.  Enters name, subject, and content.
4.  Adds supported placeholders.
5.  Previews the rendered result.
6.  Saves the template.
7.  Selects it in a campaign or auto-reply rule.

Example:

``` text
Hello {{name}},

Thank you for contacting {{company}}.

We appreciate your interest.

Regards,
{{sender_name}}
```

Template rendering must escape untrusted values appropriately to avoid
HTML injection.

------------------------------------------------------------------------

## 13. Analytics and Reporting

### 13.1 Metrics

  Metric               Definition
  -------------------- ---------------------------------------------
  Total recipients     Eligible recipients selected for a campaign
  Submitted/accepted   Requests accepted by sending provider
  Failed               Sending attempts that failed
  Delivered            Provider-confirmed delivery event
  Bounced              Provider-confirmed bounce event
  Opened               Tracked open event, if supported
  Clicked              Tracked click event, if supported

### 13.2 Reports

-   Campaign overview.
-   Date-based performance.
-   Sent and failed charts.
-   Provider-confirmed delivery and bounce metrics.
-   Recipient-level status.
-   Campaign comparison.
-   CSV report export.
-   Activity history.

Gmail SMTP acceptance does not provide complete delivery, bounce, open,
or click analytics. These metrics require provider event support or
separate tracking. Open tracking is inherently imperfect because of
image blocking and privacy protections. Do not fabricate metrics.

------------------------------------------------------------------------

## 14. AI Chatbot --- MailFlow AI Assistant

### 14.1 Purpose

Provide an in-app assistant that helps users understand MailFlow,
compose email drafts, explain campaign results, and troubleshoot errors.

The chatbot appears as a floating button, normally in the bottom-right
corner, across the authenticated application.

### 14.2 Capabilities

**Application guidance** - Explain how to import contacts. - Explain
campaign creation. - Explain scheduling. - Explain provider
connection. - Explain analytics and settings.

**AI email writing** - Generate subject lines. - Draft professional
email content. - Rewrite or improve user-provided drafts. - Suggest
calls to action. - Create reusable template drafts.

**Troubleshooting** - Explain authorized user-specific campaign
errors. - Explain failed imports. - Explain disconnected mailbox
status. - Explain queue or scheduling status.

**Context-aware help** - Dashboard: explain statistics. - Contacts:
explain import and segmentation. - Compose: help draft email content. -
Campaigns: explain statuses. - Scheduling: explain scheduled jobs. -
Analytics: explain metrics. - Settings: explain integrations.

### 14.3 Chat request workflow

1.  User opens chatbot.
2.  Frontend sends a message to the authenticated chatbot API.
3.  Backend validates identity, workspace, and rate limit.
4.  Backend loads only the user's permitted conversation history.
5.  Relevant product documentation or authorized context is retrieved.
6.  Backend calls the configured LLM provider.
7.  Response is validated and returned.
8.  Conversation and message metadata are stored.
9.  UI displays the response.

### 14.4 Safety and security

-   AI API key stays on the server.
-   Never send SMTP passwords, OAuth refresh tokens, or secrets to the
    model.
-   Each user can access only their own conversations.
-   Admin-only data is not exposed to regular users.
-   Treat user messages and retrieved content as untrusted input.
-   Use least-privilege tools and narrowly scoped data access.
-   Apply rate and usage limits.
-   Do not allow model output to execute arbitrary database queries or
    commands.
-   Require explicit confirmation before sending campaigns or performing
    consequential actions.
-   AI-generated content must be reviewed by the user before sending.

### 14.5 Future AI actions

A later release may let users ask the assistant to: - Prepare a campaign
draft. - Generate a template. - Find failed recipient records. -
Summarize a campaign report. - Suggest a contact segment.

The assistant should prepare actions first and request confirmation
before executing them.

------------------------------------------------------------------------

## 15. Transactional Emails and Notifications

### 15.1 Authentication and security emails

-   Email verification.
-   Welcome email.
-   Password reset.
-   Password changed confirmation.
-   New login alert.
-   Suspicious login notification.
-   Email change verification.
-   Admin invitation.
-   Account activation/suspension notice.

### 15.2 User notifications

-   Campaign completed.
-   Campaign partially failed.
-   Campaign failed.
-   Scheduled campaign reminder.
-   Contact import completed.
-   Mailbox disconnected.
-   Security event.

### 15.3 Admin notifications

-   New user registration.
-   Admin invitation accepted.
-   Campaign failure spike.
-   Worker unavailable.
-   Queue failures.
-   SMTP/provider connection failure.
-   Security alerts.

### 15.4 Service boundaries

  -----------------------------------------------------------------------
  Service                             Responsibility
  ----------------------------------- -----------------------------------
  `authEmailService.js`               Verification, password reset,
                                      security emails

  `campaignEmailService.js`           Bulk campaign sending

  `notificationService.js`            User and admin notifications

  `emailTemplateService.js`           Shared template rendering

  `mailboxService.js`                 Gmail and Outlook mailbox
                                      operations
  -----------------------------------------------------------------------

Transactional account emails must not be treated as marketing campaigns.
Marketing unsubscribe preferences must not suppress essential
account-security emails.

------------------------------------------------------------------------

## 16. Admin Console

### 16.1 Admin capabilities

-   View and search registered users.
-   Filter accounts by status and role.
-   Activate or suspend accounts.
-   Assign authorized roles.
-   View platform-level operational metrics.
-   Monitor campaign processing health.
-   View failed jobs and queue status.
-   Review activity and audit logs.
-   Manage platform configuration.
-   Send administrative announcements.
-   Review security events.

### 16.2 Authorization

-   Enforce all admin permissions in backend middleware and services.
-   Hide or disable unauthorized frontend controls as a usability
    measure, not as the security boundary.
-   Record privileged changes in audit logs.
-   Protect Super Admin operations.
-   Prevent users from changing their own role through ordinary profile
    APIs.

------------------------------------------------------------------------

## 17. Database Design

Suggested MongoDB collections:

  Collection          Main purpose
  ------------------- -------------------------------------------------
  Users               Identity, role, verification, onboarding
  Workspaces          Workspace ownership and settings
  Memberships         User-to-workspace membership and role
  Contacts            Recipient details and preferences
  ContactGroups       Contact grouping
  Campaigns           Campaign metadata and lifecycle
  Recipients          Per-recipient processing outcomes
  EmailAccounts       Connected mailbox metadata and encrypted tokens
  EmailTemplates      Reusable templates
  AutoReplyRules      Automated response rules
  Notifications       User and admin notifications
  ActivityLogs        Audit and activity history
  ChatConversations   User-owned chatbot conversations
  ChatMessages        Chat messages
  Sessions            Refresh session records
  Imports             Contact import jobs and summaries

### 17.1 Data ownership

Workspace-owned records should contain `workspaceId`. Records created by
a user may also contain `createdBy`.

The backend must enforce authorization in every read, update, and delete
operation. Use compound indexes where appropriate, such as workspace
plus email, workspace plus campaign creation date, and workspace plus
status.

### 17.2 Example contact record

``` js
{
  workspaceId: "workspace-id",
  createdBy: "user-id",
  name: "Customer A",
  email: "customer@example.com",
  groups: [],
  consentStatus: "unknown",
  unsubscribedAt: null,
  createdAt: new Date()
}
```

### 17.3 Example user record

``` js
{
  name: "Example User",
  email: "user@example.com",
  passwordHash: "hashed-value",
  role: "user",
  isVerified: false,
  status: "pending_verification",
  onboardingCompleted: false,
  onboardingStep: 0,
  onboardingSkipped: false
}
```

The examples are illustrative schemas, not production-ready model
definitions. Actual schema validation, indexes, references, token
records, and privacy rules must be implemented.

------------------------------------------------------------------------

## 18. Suggested Backend Folder Structure

``` text
server/
├── src/
│   ├── config/
│   │   ├── database.js
│   │   ├── redis.js
│   │   ├── passport.js
│   │   └── env.js
│   │
│   ├── models/
│   │   ├── User.js
│   │   ├── Workspace.js
│   │   ├── Membership.js
│   │   ├── Contact.js
│   │   ├── ContactGroup.js
│   │   ├── Campaign.js
│   │   ├── Recipient.js
│   │   ├── EmailAccount.js
│   │   ├── EmailTemplate.js
│   │   ├── AutoReplyRule.js
│   │   ├── Notification.js
│   │   ├── ActivityLog.js
│   │   ├── ChatConversation.js
│   │   └── ChatMessage.js
│   │
│   ├── controllers/
│   ├── routes/
│   ├── middleware/
│   ├── validators/
│   ├── services/
│   │   ├── authEmailService.js
│   │   ├── campaignEmailService.js
│   │   ├── notificationService.js
│   │   ├── emailTemplateService.js
│   │   ├── mailboxService.js
│   │   └── aiAssistantService.js
│   │
│   ├── queues/
│   │   ├── mailQueue.js
│   │   └── notificationQueue.js
│   │
│   ├── workers/
│   │   ├── campaignWorker.js
│   │   ├── notificationWorker.js
│   │   └── mailboxWorker.js
│   │
│   ├── utils/
│   └── app.js
│
├── server.js
├── worker.js
└── package.json
```

## 19. Suggested Frontend Folder Structure

``` text
client/
├── src/
│   ├── assets/
│   ├── components/
│   ├── layouts/
│   ├── pages/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── contacts/
│   │   ├── campaigns/
│   │   ├── scheduled/
│   │   ├── auto-reply/
│   │   ├── templates/
│   │   ├── analytics/
│   │   ├── settings/
│   │   └── admin/
│   │
│   ├── onboarding/
│   ├── chatbot/
│   ├── contexts/
│   ├── hooks/
│   ├── services/
│   ├── utils/
│   ├── App.jsx
│   └── main.jsx
│
└── package.json
```

Keep components reusable and avoid putting all page logic into a single
component.

------------------------------------------------------------------------

## 20. API Design Outline

Use versioned REST endpoints, consistent response shapes, centralized
error handling, and request validation.

Illustrative endpoint groups:

  --------------------------------------------------------------------------
  Module                              Example endpoints
  ----------------------------------- --------------------------------------
  Authentication                      `POST /api/v1/auth/register`,
                                      `/login`, `/logout`

  Verification                        `POST /api/v1/auth/verify-email`,
                                      `/resend-verification`

  Password                            `POST /api/v1/auth/forgot-password`,
                                      `/reset-password`

  Profile                             `GET /api/v1/users/me`,
                                      `PATCH /api/v1/users/me`

  Onboarding                          `GET /api/v1/onboarding`,
                                      `PATCH /api/v1/onboarding`

  Workspaces                          `GET /api/v1/workspaces/current`

  Contacts                            `/api/v1/contacts`

  Contact groups                      `/api/v1/contact-groups`

  Imports                             `/api/v1/contacts/imports`

  Email accounts                      `/api/v1/email-accounts`

  Campaigns                           `/api/v1/campaigns`

  Campaign actions                    Campaign preview, test, send,
                                      schedule, cancel

  Scheduled jobs                      `/api/v1/scheduled-campaigns`

  Templates                           `/api/v1/templates`

  Auto replies                        `/api/v1/auto-reply-rules`

  Analytics                           `/api/v1/analytics`

  Notifications                       `/api/v1/notifications`

  Chatbot                             `/api/v1/chat/conversations`,
                                      `/messages`

  Admin                               `/api/v1/admin/users`, `/metrics`,
                                      `/audit-logs`
  --------------------------------------------------------------------------

The final endpoint contracts, payload schemas, and authorization
requirements should be documented during the corresponding development
phase.

------------------------------------------------------------------------

## 21. Security and Reliability Requirements

### Authentication

-   Hash passwords with bcrypt.
-   Use secure, short-lived access tokens.
-   Protect refresh sessions.
-   Configure cookies, CORS, and CSRF defenses appropriately for the
    selected authentication design.
-   Validate OAuth state and callbacks.
-   Support session revocation.
-   Rate-limit authentication endpoints.

### Authorization

-   Apply role-based access control.
-   Enforce workspace ownership on every resource operation.
-   Prevent insecure direct object reference vulnerabilities.
-   Use least-privilege access for integrations.
-   Audit privileged operations.

### Data and application security

-   Validate all inputs with Zod.
-   Sanitize or safely render HTML email content.
-   Restrict file types and upload sizes.
-   Encrypt provider tokens at rest.
-   Never log secrets or raw credentials.
-   Protect against injection, XSS, CSRF, SSRF, and unsafe redirects as
    relevant.
-   Keep dependencies updated.
-   Back up important database data.

### Email compliance and deliverability

-   Maintain consent and unsubscribe records.
-   Process unsubscribe requests promptly.
-   Maintain suppression lists.
-   Authenticate sending domains when using a production provider.
-   Respect provider quotas and recipient limits.
-   Provide clear sender identity.
-   Avoid deceptive or unsolicited bulk sending.

### Reliability

-   Use retries only for retryable failures.
-   Use exponential backoff and maximum attempts.
-   Make jobs idempotent where possible.
-   Track ambiguous provider outcomes.
-   Monitor workers and queues.
-   Provide health and readiness endpoints.
-   Use structured logs and alerting.

------------------------------------------------------------------------

## 22. Testing Strategy

  -----------------------------------------------------------------------
  Test category           Tool                    Main coverage
  ----------------------- ----------------------- -----------------------
  Unit tests              Vitest                  Utilities, validators,
                                                  services

  API tests               Vitest / Supertest      Routes and middleware

  Integration tests       Vitest + test database  Database-backed
                                                  workflows

  Frontend tests          Vitest + Testing        Forms and components
                          Library                 

  End-to-end tests        Playwright              Real user journeys

  Queue tests             BullMQ test setup       Scheduling, retries,
                                                  cancellation

  Email tests             Mail sandbox/test       Message formatting and
                          account                 sending

  Manual API tests        Postman                 API contracts and error
                                                  handling
  -----------------------------------------------------------------------

### 22.1 Essential acceptance test

1.  Register two separate users.
2.  Verify both accounts.
3.  Sign in to both accounts.
4.  Complete onboarding for one and skip it for the other.
5.  Connect separate test email accounts.
6.  Import different contact lists.
7.  Create separate campaigns.
8.  Schedule one campaign.
9.  Confirm the worker processes eligible jobs.
10. Verify recipient-level outcomes.
11. Test unsubscribe enforcement.
12. Test automatic replies with controlled test mailboxes.
13. Ask chatbot questions from both accounts.
14. Verify chat history isolation.
15. Attempt cross-workspace access and confirm it is denied.
16. Sign in as an authorized admin.
17. Test admin permissions and audit logging.

------------------------------------------------------------------------

## 23. Deployment Architecture and Process

### 23.1 Recommended hosting

  Component           Initial hosting option
  ------------------- ------------------------
  Frontend            Vercel
  API server          Render
  Background worker   Render
  Database            MongoDB Atlas
  Redis               Managed Redis provider
  Source code         GitHub

### 23.2 Deployment sequence

1.  Create and configure GitHub repository.
2.  Create MongoDB Atlas database and restricted database user.
3.  Configure Redis and secure connectivity.
4.  Configure production environment variables.
5.  Deploy Express API.
6.  Deploy separate background worker.
7.  Configure email sending provider.
8.  Register production OAuth callback URLs.
9.  Deploy React frontend.
10. Configure production CORS and cookie settings.
11. Configure verified application domains.
12. Test registration and verification emails.
13. Test login and password reset.
14. Test contact import and campaign sending.
15. Test delayed jobs and worker restart recovery.
16. Verify workspace isolation.
17. Enable monitoring, backups, and error reporting.

### 23.3 Production considerations

-   Use an always-running worker for scheduled campaigns.
-   Verify provider sending limits before enabling public bulk sending.
-   Use a dedicated email provider for production marketing scale.
-   Configure SPF, DKIM, and DMARC for sending domains as appropriate.
-   Restrict MongoDB and Redis network access.
-   Use HTTPS.
-   Keep separate development and production secrets.
-   Configure backups and operational alerts.

------------------------------------------------------------------------

## 24. Development Roadmap

Development should be incremental. Each phase must be implemented,
tested, reviewed, and documented before the next phase begins.

### Phase 1 --- Project Foundation

-   Verify Node.js, npm, Git, and editor.
-   Create repository and project structure.
-   Initialize React + Vite.
-   Initialize Express backend.
-   Configure MongoDB Atlas.
-   Configure environment validation.
-   Connect frontend and backend.
-   Add health-check endpoint.

**Exit criteria:** Frontend and backend run locally, API is reachable,
and MongoDB connection works.

### Phase 2 --- Authentication and Transactional Emails

-   User model.
-   Registration and login.
-   Password hashing.
-   Email verification.
-   Welcome email.
-   Forgot/reset password.
-   JWT and refresh sessions.
-   OAuth integrations.
-   Logout and session revocation.
-   Security notifications.

**Exit criteria:** Complete authentication workflow passes tests.

### Phase 3 --- Multi-user Workspace Architecture

-   Workspace and membership models.
-   Default workspace creation.
-   Workspace authorization middleware.
-   Role and permission system.
-   Resource ownership checks.
-   Cross-workspace access tests.

**Exit criteria:** Two users cannot access each other's private records.

### Phase 4 --- First-login Onboarding

-   Welcome screen.
-   Guided product tour.
-   Step progress.
-   Skip and resume.
-   Restart tutorial.
-   Admin-specific tutorial.

**Exit criteria:** Onboarding state persists across devices and login
sessions.

### Phase 5 --- Dashboard UI

-   Main layout and sidebar.
-   Dashboard cards.
-   Responsive navigation.
-   Theme support.
-   Loading, empty, and error states.
-   Notifications.

**Exit criteria:** Authenticated users can navigate the application.

### Phase 6 --- Contact Management

-   Contact CRUD.
-   Contact groups.
-   CSV import/export.
-   Excel import/export.
-   Duplicate detection.
-   Validation and import summaries.
-   Consent and unsubscribe management.

**Exit criteria:** Contact data is correctly validated and isolated.

### Phase 7 --- Email Integration and Sending Engine

-   Gmail SMTP configuration.
-   Provider abstraction.
-   Email composer.
-   HTML and rich-text content.
-   Attachments.
-   Preview.
-   Test email.
-   Recipient-level records.
-   Provider response handling.

**Exit criteria:** Controlled test emails can be sent and outcomes
recorded.

### Phase 8 --- Campaign Management

-   Campaign CRUD.
-   Drafts.
-   Campaign preview.
-   Duplicate campaign.
-   Campaign history.
-   Recipient statuses.
-   Campaign state transitions.

**Exit criteria:** Campaign lifecycle works and is auditable.

### Phase 9 --- Scheduling and Automation

-   Redis configuration.
-   BullMQ queues.
-   Separate worker process.
-   Delayed campaigns.
-   Recurring schedules.
-   Retry and backoff.
-   Cancellation.
-   Idempotency and recovery.

**Exit criteria:** Scheduled jobs execute reliably in a continuously
running test environment.

### Phase 10 --- Automatic Replies

-   Gmail API integration.
-   Microsoft Graph integration.
-   Mailbox connection management.
-   Incoming message processing.
-   Rule configuration.
-   Template-based replies.
-   Loop and duplicate prevention.

**Exit criteria:** Controlled incoming test messages trigger the correct
response once.

### Phase 11 --- Analytics and Admin

-   Campaign analytics.
-   Provider event processing where available.
-   Report export.
-   Activity logs.
-   Admin user management.
-   Role management.
-   Queue and system monitoring.
-   Admin notifications.

**Exit criteria:** User reports are accurate and admin actions are
permission-protected.

### Phase 12 --- AI Chatbot

-   Floating chatbot UI.
-   Authenticated chat API.
-   LLM provider integration.
-   Conversation persistence.
-   Context-aware product help.
-   Email draft generation.
-   Troubleshooting assistance.
-   Rate limits and safety controls.

**Exit criteria:** Users receive useful AI help without cross-user data
exposure or unauthorized actions.

### Phase 13 --- Security and Quality Assurance

-   Security review.
-   Workspace isolation audit.
-   Unit and integration tests.
-   End-to-end tests.
-   Queue failure tests.
-   Email failure and retry tests.
-   Performance checks.
-   Accessibility checks.
-   Documentation review.

**Exit criteria:** Release candidate passes agreed acceptance tests.

### Phase 14 --- Deployment

-   Production database.
-   Managed Redis.
-   API deployment.
-   Worker deployment.
-   Frontend deployment.
-   OAuth configuration.
-   Email domain configuration.
-   Monitoring and alerting.
-   Backup and recovery validation.
-   Production smoke tests.

**Exit criteria:** The production application is accessible, secure,
monitored, and operational.

------------------------------------------------------------------------

## 25. Working Method for Guided Development

The implementation will follow this repeatable cycle:

1.  **Understand:** Explain the feature, its purpose, and how it fits
    the architecture.
2.  **Design:** Identify models, APIs, UI components, and dependencies.
3.  **Implement:** Build in small, understandable steps.
4.  **Run:** Execute frontend, backend, database, or worker as
    applicable.
5.  **Test:** Verify success cases and failure cases.
6.  **Debug:** Diagnose actual errors and correct the root cause.
7.  **Review:** Explain important code and security decisions.
8.  **Commit:** Save a working milestone to GitHub.
9.  **Proceed:** Move to the next feature only after the current exit
    criteria are met.

Do not generate the entire application in one large code dump. Build
file by file and keep the implementation understandable and
maintainable.

------------------------------------------------------------------------

## 26. Future Enhancements --- Not Required for Initial Release

These can be considered after the core product is stable:

-   Subscription plans and billing.
-   Usage quotas and paid tiers.
-   Additional SMTP/email service providers.
-   Advanced segmentation.
-   A/B campaign testing.
-   Advanced recurring automation.
-   More sophisticated analytics.
-   Team workspaces and invitations.
-   Custom sending domains.
-   AI-assisted campaign optimization.
-   Approval workflows for campaign managers.
-   Mobile application.
-   Advanced audit and compliance reporting.

These enhancements should not delay the initial core release.

------------------------------------------------------------------------

## 27. Final Project Acceptance Checklist

### User and workspace

-   [ ] Public registration works.
-   [ ] Email verification works.
-   [ ] Login and logout work.
-   [ ] Password reset works.
-   [ ] OAuth flows work for configured providers.
-   [ ] Workspace is created for each user.
-   [ ] Cross-workspace access is blocked.
-   [ ] Roles are enforced by the backend.

### Onboarding and dashboard

-   [ ] First login launches the tutorial.
-   [ ] Tutorial progress is saved.
-   [ ] Skip, resume, and restart work.
-   [ ] Dashboard metrics are based on real data.
-   [ ] Responsive layout works.

### Contacts and campaigns

-   [ ] Contact CRUD works.
-   [ ] CSV and Excel imports work.
-   [ ] Duplicates and invalid records are handled.
-   [ ] Unsubscribe and suppression checks work.
-   [ ] Campaign drafts work.
-   [ ] Preview and test sending work.
-   [ ] Recipient-level statuses are stored.
-   [ ] Campaign cancellation is handled safely.

### Email and automation

-   [ ] Email provider connection is secure.
-   [ ] Sending limits are enforced.
-   [ ] Scheduled jobs execute.
-   [ ] Retry behavior is tested.
-   [ ] Worker restart recovery is tested.
-   [ ] Auto-reply loop prevention works.
-   [ ] Transactional emails are separate from marketing preferences.

### AI and administration

-   [ ] Chatbot is authenticated.
-   [ ] Chat history is user-isolated.
-   [ ] AI API key is server-side only.
-   [ ] AI actions require confirmation.
-   [ ] Admin access is restricted.
-   [ ] Audit logs capture privileged actions.

### Quality and deployment

-   [ ] Unit tests pass.
-   [ ] Integration tests pass.
-   [ ] End-to-end acceptance tests pass.
-   [ ] Production secrets are configured securely.
-   [ ] Frontend, API, worker, database, and Redis are operational.
-   [ ] Monitoring and backups are configured.
-   [ ] Production smoke tests pass.

------------------------------------------------------------------------

## 28. Final Scope Statement

MailFlow is a multi-user, cloud-deployed bulk email and campaign
automation platform built with the MERN stack. It combines secure
authentication, workspace isolation, contact management, bulk email
sending, campaign scheduling, automatic replies, templates, analytics,
transactional notifications, an interactive onboarding tutorial, an AI
assistant, and administrative controls.

The project is intended to demonstrate practical full-stack engineering:
frontend architecture, backend API design, database modelling,
authentication, OAuth, third-party integrations, asynchronous job
processing, AI integration, testing, security, and cloud deployment.

**Initial development starting point:** Phase 1 --- verify the local
development environment, create the repository, initialize React + Vite
and Express, configure MongoDB Atlas, and establish a working
frontend-backend connection.
