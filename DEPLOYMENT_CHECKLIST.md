# MAILFLOW PRODUCTION DEPLOYMENT & READINESS CHECKLIST

This document details the configuration requirements, environment specifications, verification steps, and operational procedures for deploying the MailFlow SaaS email campaign and automation platform to production environments.

---

## 1. ARCHITECTURE & SERVICES OVERVIEW

```mermaid
flowchart TD
    subgraph Edge / Client
        Users[Web Clients] -->|HTTPS| Cloudflare[CDN / Reverse Proxy / SSL]
    end

    subgraph MailFlow Application Tier
        Cloudflare -->|Port 443 / 80| Nginx[Reverse Proxy]
        Nginx -->|Static Assets| ClientApp[Vite React SPA Dist]
        Nginx -->|/api/*| ExpressAPI[MailFlow API Cluster (Node.js)]
        ExpressAPI --> BullMQProducer[BullMQ Job Producer]
        BullMQWorker[Dedicated Worker Node(s)] -->|Consumer| BullMQProducer
    end

    subgraph Data Stores
        ExpressAPI -->|Read / Write| MongoDB[(MongoDB 7+ Replica Set)]
        BullMQWorker -->|Job Fetch / Update| MongoDB
        BullMQProducer -->|Queue State| RedisCluster[(Redis 7+ Sentinel / Cluster)]
        BullMQWorker -->|Queue Worker| RedisCluster
    end

    subgraph External Email Providers
        ExpressAPI -.->|Transactional SMTP| Sendliberty[Sendliberty / Postmark]
        BullMQWorker -->|OAuth2 REST API| GoogleAPI[Google Gmail API]
        BullMQWorker -->|OAuth2 REST API| MicrosoftAPI[Microsoft Graph API]
        BullMQWorker -->|SMTP / IMAP| CustomMailbox[Custom Mailbox Provider]
        MicrosoftAPI -.->|Webhooks| ExpressAPI
    end
```

---

## 2. PRODUCTION ENVIRONMENT VARIABLES

The backend server strictly validates all required environment variables on startup (`server/src/config/env.js`). Missing or malformed required variables prevent application boot with detailed validation messages.

### A. Core Server & Infrastructure
| Variable | Required | Example / Default | Description |
|---|---|---|---|
| `NODE_ENV` | Yes | `production` | Enables production security policies, hides internal stack traces, enables cookie security flags. |
| `PORT` | Yes | `5000` | Port on which the Express HTTP server listens. |
| `MONGODB_URI` | Yes | `mongodb+srv://.../mailflow?retryWrites=true&w=majority` | Connection string to MongoDB 7+ replica set. |
| `REDIS_URL` | Yes (for Queues) | `redis://:secret@redis-cluster:6379` | High-availability Redis instance for BullMQ and distributed locks. |
| `QUEUE_FEATURES_ENABLED` | Optional | `true` | Set to `true` to activate BullMQ dispatching and queue monitoring. |
| `FRONTEND_URL` | Yes | `https://app.mailflow.io` | Allowed CORS origin; used for generating email verification and reset links. |
| `API_BASE_URL` | Yes | `https://api.mailflow.io` | External public URL for tracking pixels, click redirects, and webhook endpoints. |

### B. Security & Cryptography
| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | Yes | 64+ character random hex string for signing short-lived access tokens (15m expiry). |
| `JWT_REFRESH_SECRET` | Yes | 64+ character random hex string for signing long-lived refresh tokens (7d expiry, HttpOnly cookie). |
| `ENCRYPTION_KEY` | Yes | 32-byte (64 hex characters) key for AES-256-GCM encryption of OAuth tokens and mailbox passwords at rest. |

### C. Email Integration Providers
| Variable | Required | Description |
|---|---|---|
| `CAMPAIGN_EMAIL_PROVIDER` | Yes | Set to `mailbox` (recommended for multi-tenant mailbox sending) or `sendliberty`. |
| `TRANSACTIONAL_EMAIL_PROVIDER` | Yes | Set to `sendliberty` or `smtp` for system password resets and verification emails. |
| `SENDLIBERTY_API_KEY` | If Sendliberty | Sendliberty API key for transactional emails. |
| `SENDLIBERTY_FROM_EMAIL` | If Sendliberty | Authorized transactional sender email (e.g., `noreply@mailflow.io`). |
| `GOOGLE_CLIENT_ID` | Optional | OAuth2 Client ID for Google Workspace / Gmail account connection. |
| `GOOGLE_CLIENT_SECRET` | Optional | OAuth2 Client Secret for Google. |
| `GOOGLE_REDIRECT_URI` | Optional | `https://api.mailflow.io/api/v1/auth/google/callback` |
| `MICROSOFT_CLIENT_ID` | Optional | Azure AD Application ID for Outlook / Office 365 mailbox connection. |
| `MICROSOFT_CLIENT_SECRET` | Optional | Azure AD Application Secret. |
| `MICROSOFT_REDIRECT_URI` | Optional | `https://api.mailflow.io/api/v1/auth/microsoft/callback` |

### D. AI Assistant Service
| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Optional | Google Gemini API key for AI email drafting and assistant capabilities. |
| `OPENAI_API_KEY` | Optional | OpenAI API key (used if Gemini is not configured). |

---

## 3. PRE-DEPLOYMENT VERIFICATION STEPS

1. **Database Indices and Schema Validation**
   - Ensure MongoDB replica set is online.
   - Run indexing script or allow Mongoose models to verify unique compound indexes:
     - `CampaignRecipient`: `[campaignId, contactId]` (unique)
     - `TrackingEvent`: `[trackingToken, eventType]`
     - `Contact`: `[workspaceId, email]` (unique)
     - `EmailAccount`: `[workspaceId, email]` (unique)

2. **Frontend Build Verification**
   ```bash
   npm --workspace=client run build
   ```
   - Confirms zero JSX/TypeScript bundling errors and generates production bundle in `client/dist`.

3. **Backend Test Suite & Security Regression**
   ```bash
   npm --workspace=server run test
   ```
   - Confirms all 18 test suites pass:
     1. `test_phase1_stabilization.js` (Auth fallback protection, ReDoS protection, Queue rollback)
     2. `test_phase2_tracking_attachments.js` (Pixel format, click tracking, open redirects, Graph webhook, attachments)
     3. `test_phase3_admin_notifications.js` (Notifications center, admin console, queue monitoring)
     4. `test_phase4_ai_assistant.js` (AI assistant, multi-tenant IDOR isolation, message exchange)
     5. `test_security_qa_comprehensive.js` (Formula injection, NoSQL injection, path traversal, privilege escalation)
     6. `test_phase3_workspace.js` (Multi-tenant boundaries, roles & permissions)
     7. `test_phase6_contacts.js` (Contact CRUD, CSV/XLSX import & export, suppressions)
     8. `test_phase7_email.js` (OAuth mailbox connection, token refresh, token encryption)
     9. `test_phase8_campaigns.js` (Campaign composition, recipient audit trail, deduplication)
     10. `test_phase9_scheduling.js` (Future scheduling, rescheduling, cancellations, automation rules)
     11. `test_phase10_autoreply.js` (Auto-reply triggers, keyword matching, loop prevention, cooldowns)
     12. `test_phase11_analytics.js` (Delivery rate, click-to-open calculations, audit logging)
     13. `test_phase12_production.js` (Worker lifecycle, graceful shutdown, health probes)
     14. `test_deployment_readiness.js` (Full environment validation, cookie security)
     15. `test_sendliberty.js` (Transactional provider integration)
     16. `test_redis_bullmq_integration.js` (Queue options, exponential backoff, reconnect recovery)
     17. `test_transactional_email.js` (Expiring single-use tokens, auth rate limiting)
     18. `test_security_review.js` (Header spoofing protection, error masking, NoSQL attack protection)

---

## 4. WORKER DEPLOYMENT TOPOLOGY

In high-volume production deployments:
- **API Nodes (`web` process)**: Run `node server/src/index.js` with `QUEUE_FEATURES_ENABLED=true` to produce jobs and handle HTTP API traffic.
- **Worker Nodes (`worker` process)**: Deploy dedicated background instances running `node server/src/workers/campaignWorker.js` and `node server/src/workers/autoReplyWorker.js` to process heavy campaign email distribution independently of the web request loop.

---

## 5. RECOVERY & ROLLBACK STRATEGY

- **Stuck Queue Recovery**: In case of unexpected server crashes during queue dispatch, MailFlow's reconciliation system automatically detects campaigns stuck in `SCHEDULED` or `QUEUED` states with no active BullMQ jobs and rolls them back to `DRAFT` or flags them for administrative review.
- **Dead Letter Queue (DLQ)**: Failed BullMQ campaign jobs retain error logs and stack traces for 7 days in Redis, viewable by authorized platform administrators from `/admin` (System & Queue Monitoring tab) with single-click retry capability.
- **Graceful Shutdown**: All API and worker processes listen for `SIGINT` and `SIGTERM`, draining in-flight email batches (up to 10 seconds timeout) before disconnecting Mongoose and Redis connections.

