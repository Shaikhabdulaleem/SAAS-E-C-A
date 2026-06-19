# NexusHQ Backend Implementation Plan

## Current Frontend Contract

The frontend is a Vite React app using in-memory context data. The first backend milestone should replace these mock contexts without forcing a redesign of the UI.

Frontend modules to support:

- Authentication: demo login currently returns `User` with `role`, optional `tenantId`, `tenantName`, and `enabledServices`.
- Tenant/MCC admin: tenants, plans, enabled services, status, seats, MRR, integrations, integration costs.
- CRM: contacts, companies, deals, activities.
- Email marketing: campaigns, templates, scheduled/sent states, delivery metrics.
- AI assistant: chat messages, CRM-aware answers, email generation, sales summaries.
- Settings: profile, notification preferences, sender email/domain preferences, plan display.

## Recommended Backend Stack

- Runtime: Node.js with TypeScript.
- API framework: NestJS or Express/Fastify. NestJS is recommended if the app will grow into multiple modules and background workers.
- Database: PostgreSQL.
- ORM: Prisma for speed and clear schema ownership, or Drizzle if the team wants more SQL-level control.
- Auth: JWT access tokens plus refresh tokens stored server-side.
- Jobs: BullMQ with Redis for campaign sending, scheduled campaigns, email tracking jobs, AI summaries, and webhooks.
- Email provider: SendGrid or Postmark.
- AI provider: OpenAI API.
- Object/file storage: S3-compatible storage later for imports, exports, attachments, and email assets.

## Backend Modules

### 1. Auth And Users

Responsibilities:

- Register/login/logout.
- Refresh token rotation.
- Password hashing with Argon2 or bcrypt.
- Role-based access control.
- Superadmin access for MCC pages.
- Client access scoped to one tenant/organization.

Core tables:

- `users`
- `sessions`
- `refresh_tokens`
- `password_reset_tokens`
- `audit_logs`

Initial endpoints:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `PATCH /api/users/me`
- `PATCH /api/users/me/preferences`

### 2. Tenants / MCC Admin

Responsibilities:

- Manage customer accounts.
- Manage tenant plan, services, status, seats, MRR, notes.
- Manage third-party integrations per tenant.
- Restrict all MCC routes to `superadmin`.

Core tables:

- `tenants`
- `tenant_users`
- `tenant_services`
- `plans`
- `tenant_integrations`
- `integration_platforms`

Initial endpoints:

- `GET /api/admin/tenants`
- `POST /api/admin/tenants`
- `GET /api/admin/tenants/:tenantId`
- `PATCH /api/admin/tenants/:tenantId`
- `DELETE /api/admin/tenants/:tenantId`
- `POST /api/admin/tenants/:tenantId/integrations`
- `PATCH /api/admin/tenants/:tenantId/integrations/:integrationId`
- `DELETE /api/admin/tenants/:tenantId/integrations/:integrationId`

Security notes:

- Store integration secrets encrypted at rest.
- Never return raw API keys by default. Return masked values and expose a separate short-lived reveal endpoint for superadmins.

### 3. CRM

Responsibilities:

- CRUD contacts, companies, and deals.
- Activity timeline generation.
- Search, filters, sorting, and pagination.
- Basic ownership/assignment rules.

Core tables:

- `contacts`
- `companies`
- `deals`
- `pipeline_stages`
- `activities`
- `contact_tags`
- `company_tags`
- `deal_contacts`

Initial endpoints:

- `GET /api/contacts`
- `POST /api/contacts`
- `GET /api/contacts/:contactId`
- `PATCH /api/contacts/:contactId`
- `DELETE /api/contacts/:contactId`
- `GET /api/companies`
- `POST /api/companies`
- `GET /api/companies/:companyId`
- `PATCH /api/companies/:companyId`
- `DELETE /api/companies/:companyId`
- `GET /api/deals`
- `POST /api/deals`
- `GET /api/deals/:dealId`
- `PATCH /api/deals/:dealId`
- `DELETE /api/deals/:dealId`
- `GET /api/activities`
- `POST /api/activities`

Implementation rules:

- Every tenant-scoped row must include `tenant_id`.
- Every tenant-scoped query must filter by authenticated `tenant_id`.
- The frontend must never send `tenant_id` as the source of truth.
- Create an activity when a contact, company, deal, campaign, or integration is created or changed.

### 4. Email Marketing

Responsibilities:

- Create draft and scheduled campaigns.
- Store reusable templates.
- Track campaign recipients.
- Send campaigns in background jobs.
- Receive provider webhooks for delivered/open/click/bounce/unsubscribe.

Core tables:

- `email_templates`
- `email_campaigns`
- `campaign_recipients`
- `email_events`
- `sender_identities`
- `suppression_list`

Initial endpoints:

- `GET /api/email/campaigns`
- `POST /api/email/campaigns`
- `GET /api/email/campaigns/:campaignId`
- `PATCH /api/email/campaigns/:campaignId`
- `POST /api/email/campaigns/:campaignId/schedule`
- `POST /api/email/campaigns/:campaignId/send-test`
- `POST /api/email/campaigns/:campaignId/send-now`
- `GET /api/email/templates`
- `POST /api/email/templates`
- `PATCH /api/email/templates/:templateId`
- `DELETE /api/email/templates/:templateId`
- `POST /api/webhooks/email/sendgrid`

MVP simplification:

- Start with one audience rule: all contacts or contacts filtered by status/tags.
- Defer complex automation, drip campaigns, and visual builders.

### 5. AI Assistant

Responsibilities:

- Persist chat sessions and messages.
- Retrieve tenant-scoped CRM context.
- Generate CRM answers, sales summaries, deal insights, and email drafts.
- Enforce AI usage quotas per plan.

Core tables:

- `ai_sessions`
- `ai_messages`
- `ai_usage_events`

Initial endpoints:

- `GET /api/ai/sessions`
- `POST /api/ai/sessions`
- `GET /api/ai/sessions/:sessionId/messages`
- `POST /api/ai/chat`
- `POST /api/ai/generate-email`
- `GET /api/ai/daily-summary`

Safety rules:

- AI context queries must be tenant-scoped.
- Do not send integration API keys or sensitive credentials to the model.
- Log token usage and model cost per tenant.

### 6. Dashboard And Reporting

Responsibilities:

- Provide aggregated counts and metrics used by dashboard cards and charts.
- Avoid making the frontend fetch every row just to compute totals.

Initial endpoints:

- `GET /api/dashboard/summary`
- `GET /api/dashboard/pipeline`
- `GET /api/dashboard/campaign-performance`
- `GET /api/dashboard/recent-activities`

## Database Model Priorities

Build the schema in this order:

1. Identity: `users`, `tenants`, `tenant_users`, `sessions`, `refresh_tokens`.
2. Platform config: `plans`, `tenant_services`, `integration_platforms`, `tenant_integrations`.
3. CRM: `companies`, `contacts`, `pipeline_stages`, `deals`, `activities`.
4. Email: `email_templates`, `email_campaigns`, `campaign_recipients`, `email_events`, `sender_identities`.
5. AI: `ai_sessions`, `ai_messages`, `ai_usage_events`.
6. Ops: `audit_logs`, `webhook_events`, `job_runs`.

Recommended indexes:

- `tenant_id` on every tenant-scoped table.
- `(tenant_id, email)` unique on contacts.
- `(tenant_id, status)` on contacts, deals, campaigns, tenants.
- `(tenant_id, company_id)` on contacts and deals.
- `(tenant_id, created_at DESC)` on activities and campaigns.
- Full-text search indexes for contact names/emails, company names/domains, and deal titles.

## API Response Standards

Use a consistent response envelope:

```json
{
  "data": {},
  "meta": {},
  "error": null
}
```

For lists:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 25,
    "total": 100
  },
  "error": null
}
```

Error shape:

```json
{
  "data": null,
  "meta": {},
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "fields": {
      "email": "Required"
    }
  }
}
```

## Frontend Migration Plan

### Phase A: API Client Layer

- Add `src/app/lib/api.ts`.
- Add typed API functions for auth, tenants, CRM, campaigns, templates, AI, and dashboard.
- Keep contexts, but make them call the API instead of mock arrays.
- Add loading and error states to each page as needed.

### Phase B: Auth Provider Replacement

- Replace hardcoded login users with `POST /api/auth/login`.
- Store access token in memory and refresh token as an HTTP-only cookie if backend and frontend share domain.
- Keep `localStorage` only for non-sensitive UI state.

### Phase C: Data Provider Replacement

- Load CRM records from API on provider mount or page load.
- Convert add/update/delete functions to async API calls.
- Optimistically update where low risk, especially simple field edits.

### Phase D: Tenant Provider Replacement

- Superadmin pages call admin tenant endpoints.
- Client users receive tenant/service access from `/api/auth/me`.
- Hide or block disabled services based on backend capabilities, not just local context.

### Phase E: AI And Email Workflows

- Route AI chat to `/api/ai/chat`.
- Route campaign scheduling/sending to backend jobs.
- Update campaign detail from metrics endpoints or webhook-updated records.

## MVP Build Order

### Week 1: Foundation

- Create backend app, linting, TypeScript config, env validation.
- Add PostgreSQL, ORM, migrations, seed script.
- Implement health endpoint and structured logging.
- Define shared API response and error format.

Deliverable: backend runs locally and connects to database.

### Week 2: Auth And Multi-Tenancy

- Implement users, tenants, tenant memberships, sessions.
- Add login, refresh, logout, and `/auth/me`.
- Add RBAC middleware.
- Seed superadmin and demo tenants matching frontend mock data.

Deliverable: frontend can log in through backend.

### Week 3: MCC Tenant Admin

- Implement tenant CRUD.
- Implement enabled services and plan/status changes.
- Implement integrations with encrypted secrets.
- Add audit logs for admin actions.

Deliverable: MCC screens persist real tenant data.

### Week 4: CRM

- Implement companies, contacts, deals, activities.
- Add search/filter/pagination.
- Create activity records for major changes.
- Seed mock CRM data.

Deliverable: CRM pages persist data and support detail views.

### Week 5: Email Marketing

- Implement campaigns and templates.
- Implement sender identity settings.
- Add scheduled campaign job queue.
- Add provider webhook endpoint and event persistence.

Deliverable: campaigns can be drafted, scheduled, sent in test mode, and report metrics.

### Week 6: AI Assistant And Dashboard

- Implement AI chat endpoint with tenant-scoped CRM context.
- Persist AI messages.
- Implement daily summary and email draft generation.
- Add dashboard aggregation endpoints.

Deliverable: AI assistant and dashboard use backend data.

### Week 7: Hardening

- Add integration tests for auth, tenant isolation, CRM CRUD, campaigns, AI context.
- Add rate limiting.
- Add request validation.
- Add backup/restore notes.
- Add production env documentation.

Deliverable: production-ready MVP candidate.

## Security Acceptance Criteria

- Passwords are never stored in plain text.
- Integration API keys are encrypted at rest.
- A client user cannot access MCC admin endpoints.
- A client user cannot query another tenant's CRM, campaign, or AI data.
- Every write creates or can create an audit/activity record.
- Email provider webhooks validate signatures.
- AI endpoints apply plan/service checks and usage limits.

## Testing Plan

Minimum backend tests:

- Auth success/failure and refresh token rotation.
- Superadmin versus client route permissions.
- Tenant isolation for contacts, companies, deals, campaigns, and AI messages.
- CRUD validation for all frontend-backed entities.
- Campaign scheduling job creation.
- Email webhook idempotency.
- AI prompt/context builder excludes cross-tenant data and secrets.

## Environment Variables

Initial variables:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `ENCRYPTION_KEY`
- `OPENAI_API_KEY`
- `SENDGRID_API_KEY`
- `SENDGRID_WEBHOOK_PUBLIC_KEY`
- `APP_URL`
- `API_URL`
- `CORS_ORIGINS`
- `NODE_ENV`

## Definition Of Done For Backend MVP

- Frontend can run without mock data contexts.
- Login/logout works against the backend.
- Superadmin can create, edit, suspend, and delete tenants.
- Tenant services control client access.
- Contacts, companies, deals, campaigns, templates, activities, and AI messages persist in PostgreSQL.
- Email campaigns can be scheduled and provider events update metrics.
- AI chat can answer with tenant-scoped CRM context.
- Dashboard reads aggregate endpoints.
- Tests prove role access and tenant isolation.
- Seed data supports the current demo experience.
