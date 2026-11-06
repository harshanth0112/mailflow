# Production Deployment & Hosting Architecture Guide

This guide outlines production hardening, environment provisioning, deployment checklists, and disaster recovery procedures for **MailFlow**.

---

## 1. Production Architecture Overview

MailFlow employs a decoupled, multi-tenant cloud architecture:

```
                  +-----------------------------------+
                  |   Cloudflare / Route 53 (DNS)     |
                  +-----------------+-----------------+
                                    |
                    +---------------+---------------+
                    | HTTPS / TLS 1.3 / WAF         |
                    v                               v
+-------------------------------+   +-------------------------------+
|       Frontend Web SPA        |   |      API Backend Server       |
|    (Vercel / Cloudflare)      |   |   (AWS ECS / Render / Fly.io) |
|   Static Assets + CDN Edge    |   |     Node.js Express Cluster   |
+-------------------------------+   +---------------+---------------+
                                                    |
                         +--------------------------+--------------------------+
                         |                                                     |
                         v                                                     v
          +------------------------------+                      +------------------------------+
          |      MongoDB Atlas M10+      |                      |         Redis Cloud          |
          | Multi-AZ Replica Set Cluster |                      |   BullMQ Queue & Cache       |
          +------------------------------+                      +--------------+---------------+
                                                                               |
                                                                               v
                                                                +------------------------------+
                                                                |   Background Worker Dyno     |
                                                                |   Campaign & Auto-Reply      |
                                                                |  (Separate container/process)|
                                                                +------------------------------+
```

---

## 2. Environment Variables & Secret Configuration

Never commit production `.env` files into version control. Store credentials securely using your hosting platform's secret manager (e.g. AWS Secrets Manager, Doppler, Vercel Environment Variables, Render Secrets).

### Backend (`server/.env`) Production Reference:
| Variable | Production Value / Description | Required |
|---|---|---|
| `PORT` | `5000` or assigned by platform dyno | Yes |
| `NODE_ENV` | `production` | Yes |
| `CLIENT_URL` | `https://app.mailflow.io` (Strict CORS domain) | Yes |
| `API_BASE_URL` | `https://api.mailflow.io` | Yes |
| `MONGODB_URI` | `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/mailflow_prod?retryWrites=true&w=majority&appName=MailFlowCluster` | Yes |
| `REDIS_URL` | `rediss://default:<password>@<redis-host>:<port>` (TLS enabled) | Yes |
| `JWT_ACCESS_SECRET` | 64-character random cryptographically secure hex secret | Yes |
| `JWT_REFRESH_SECRET` | 64-character random cryptographically secure hex secret | Yes |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Yes |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Yes |
| `ENCRYPTION_KEY` | 64-character hex key for AES-256-GCM mailbox token encryption at rest | Yes |
| `SMTP_HOST` | Production SMTP hostname (e.g. `smtp.sendgrid.net`, `email-smtp.us-east-1.amazonaws.com`) | Yes |
| `SMTP_PORT` | `587` or `465` | Yes |
| `SMTP_SECURE` | `false` (for 587 STARTTLS) or `true` (for 465) | Yes |
| `SMTP_USER` | SMTP username | Yes |
| `SMTP_PASS` | SMTP secret/password | Yes |
| `SMTP_FROM_EMAIL` | `notifications@mailflow.io` | Yes |
| `SMTP_FROM_NAME` | `"MailFlow Team"` | Yes |
| `GOOGLE_CLIENT_ID` | Google Cloud Console OAuth 2.0 Web Client ID | Optional (if Gmail enabled) |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console OAuth 2.0 Client Secret | Optional (if Gmail enabled) |
| `GOOGLE_CALLBACK_URL` | `https://api.mailflow.io/api/v1/auth/oauth/google/callback` | Optional (if Gmail enabled) |
| `MICROSOFT_CLIENT_ID` | Microsoft Azure Entra ID App Client ID | Optional (if Outlook enabled) |
| `MICROSOFT_CLIENT_SECRET` | Microsoft Azure Entra ID App Secret | Optional (if Outlook enabled) |
| `MICROSOFT_CALLBACK_URL` | `https://api.mailflow.io/api/v1/auth/oauth/microsoft/callback` | Optional (if Outlook enabled) |

### Frontend (`client/.env`) Production Reference:
| Variable | Value | Description |
|---|---|---|
| `VITE_API_URL` | `https://api.mailflow.io/api/v1` | Backend REST API endpoint |

---

## 3. Database Reliability, Backup & Recovery

### Connection Pooling & Resilience
- Mongoose is configured with `maxPoolSize: 20`, `minPoolSize: 5`, `serverSelectionTimeoutMS: 5000`, and `socketTimeoutMS: 45000`.
- Automatic reconnect event listeners monitor connection health without crashing the web process.

### MongoDB Atlas Automated Backups
1. **Continuous Cloud Backups (Point-in-Time Recovery):** Enable Point-in-Time Recovery (PITR) in MongoDB Atlas with 1-minute granularity and 7-day retention.
2. **Snapshot Schedule:**
   - Daily snapshots retained for 30 days.
   - Weekly snapshots retained for 12 months.
3. **Manual CLI Backup (`mongodump`):**
   ```bash
   mongodump --uri="mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/mailflow_prod" \
     --archive="/backups/mailflow_backup_$(date +%Y%m%d_%H%M%S).gz" --gzip
   ```
4. **Restore Procedure (`mongorestore`):**
   ```bash
   mongorestore --uri="mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/mailflow_prod" \
     --archive="/backups/mailflow_backup_20261106_120000.gz" --gzip --drop
   ```
   *(Note: The `--drop` flag safely removes existing collections prior to restoration).*

---

## 4. Redis & Worker Process Architecture

MailFlow decouples HTTP API traffic from resource-intensive asynchronous jobs (campaign delivery, queue dispatch, scheduled campaign monitoring, inbox polling, and auto-reply dispatch).

### Running Independent Services in Production:
- **Web API Service:**
  ```bash
  cd server && npm run start
  # Or with process manager:
  pm2 start src/server.js --name "mailflow-api" -i max
  ```
- **Background Worker Service:**
  ```bash
  cd server && npm run worker
  # Or with process manager:
  pm2 start src/worker.js --name "mailflow-worker" -i 2
  ```

### BullMQ Configuration
- Workers use exponential backoff (`delay: 2000ms`, `attempts: 3`).
- Completed jobs are cleaned after 24 hours (`count: 1000`).
- Failed jobs are preserved for 7 days (`count: 5000`) for diagnostic auditing.
- Stalled jobs are automatically recovered via BullMQ lock renewing and stall checks (`stalledInterval: 30000`).

---

## 5. Security & Hardening Checklist

- [x] **Password Security:** Scrypt / Bcrypt with 12 salt rounds. Plaintext passwords never logged or persisted.
- [x] **Token Security:** Short-lived JWT access tokens (15m) + Single-use rotated refresh tokens (7d) stored in secure, `HttpOnly`, `SameSite=strict` cookies.
- [x] **Token Encryption at Rest:** OAuth tokens encrypted via `AES-256-GCM` with random 96-bit initialization vectors.
- [x] **Rate Limiting:**
  - Login: 10 requests / 15 minutes.
  - Password Reset: 5 requests / 1 hour.
  - Auth routes: 60 requests / 15 minutes.
  - General API: 300 requests / 15 minutes.
- [x] **Injection Protection:** Custom `mongoSanitize` middleware strips NoSQL operator injections (`$`, `.`).
- [x] **HTTP Security Headers:** Helmet configured with strict CSP, `X-Content-Type-Options: nosniff`, and `HSTS`.
- [x] **Log Sanitization:** Structured JSON logger automatically redacts passwords, tokens, API keys, and authorization headers.
- [x] **Multi-Tenant Isolation:** All queries strictly scoped by `workspaceId` and verified against validated user memberships.
- [x] **Spreadsheet Formula Protection:** Export and import utilities sanitize leading `=`, `+`, `-`, `@` characters to prevent CSV formula injection.
- [x] **Anti-Spam & Delivery Safeguards:** Strict pre-send compliance checks reject contacts who have unsubscribed or lack explicit `opted_in` consent.

---

## 6. Health & Monitoring Endpoints

- **Public Health Probe:** `GET /api/v1/health`
  - Returns `200 OK` for container readiness / liveness probes.
  - Does NOT disclose sensitive credentials or internal topology.
- **Admin System Monitor:** `GET /api/v1/analytics/admin/health`
  - Authenticated and authorized for workspace administrators (`settings:manage`).
  - Reports queue job counts, Redis connectivity, and worker availability.

---

## 7. Production Deployment Checklist

Before switching DNS to live traffic:
1. Ensure all CI/CD test workflows pass cleanly.
2. Confirm production database replica set is healthy in MongoDB Atlas.
3. Confirm Redis Cloud cluster is reachable with TLS (`rediss://`).
4. Set `NODE_ENV=production` on both web API and worker environments.
5. Generate unique `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `ENCRYPTION_KEY` secrets.
6. Verify DNS records for SPF, DKIM, and DMARC for custom transactional sending domains.
7. Test `/api/v1/health` endpoint from external monitoring tools (Datadog, UptimeRobot, Pingdom).

