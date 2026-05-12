# SDLC Hub — Architecture Document

> **Last updated**: 2026-05-09
> **Status**: Reflects actual implemented codebase state (May 2026)

## 1. Introduction

This document describes the solution architecture for SDLC Hub, including system context, major components, data model, and quality attributes. The architecture is designed to be modular so that each SDLC capability (workflow, quality, traceability, knowledge) can evolve independently.

## 2. Architectural Goals & Constraints

- Support modular feature development while remaining a single deployable application (modular monolith in v1).
- Make it easy to add new integrations and metrics without breaking existing ones.
- Favor open standards and HTTP APIs (REST, webhooks, OAuth2/OIDC).
- Deployable on a container platform (Kubernetes or equivalent).

Constraints:

- Primary tech stack:
  - Backend: Node.js (NestJS).
  - Frontend: React 19 SPA (confirmed).
  - Database: PostgreSQL with Prisma ORM for type-safe queries and declarative migrations.
  - API protocol: REST for MVP (with aggregated endpoints for complex views). GraphQL deferred to future versions.
- All external systems accessed via public APIs / webhooks.

## 3. System Context View

Actors:

- Org Admin, Project Owner, Developer, QA/DevOps/SRE.

External systems:

- Issue tracker (Jira, GitLab Issues).
- Source control (GitHub, GitLab).
- CI/CD systems (GitHub Actions, GitLab CI, Jenkins).
- Quality tools (SonarQube, SAST/SCA scanners).
- Incident management (PagerDuty).

SDLC Hub sits between these tools, pulling data (polling/API) and receiving events (webhooks), then providing dashboards and APIs to users.

## 4. Logical / Component View

### 4.1 Frontend (Web App)

- **UI Shell & Navigation** — layout, routing, auth guard, sidebar navigation.
- **Project & Integration Settings Module** — views to create projects and manage integrations.
- **Workflow Dashboard Module** — Kanban view, SDLC flow configuration.
- **Quality Gate Module** — views for gates, build/quality reports, and violations.
- **Traceability Module** — requirement → story → PR → build → release linking UI.
- **Metrics & Analytics Module** — DORA metrics, flow metrics, MTTR, CFR dashboards.
- **Retrospectives Module** — retro CRUD, tags, action items, incident post-mortem linking.
- **Test Management Module** — test cases, test plans, test runs, CI result ingestion.
- **Incident Management Module** — incident lifecycle, PagerDuty integration.
- **AI-DLC Module** — AI-driven development lifecycle session viewer.

Frontend communicates with backend over HTTPS via REST APIs.

### 4.2 Backend (API Server)

The backend uses 4 logical service groups as a modular monolith. Each owns its tables; cross-service access goes through the service layer, not direct DB queries. Services split only when a different scaling or operational profile demands it.

| Service Group | Responsibility | Modules |
|---|---|---|
| **Platform Service** | Auth (JWT + Passport), sessions, RBAC, organizations, projects, SDLC workflow configuration | Auth, Users, Organizations, Projects |
| **Ingestion Service** | Integration settings, token management, adapter interfaces (Jira, GitHub, GitLab, CI/CD, Jenkins, SonarQube, SAST), webhook consumption, scheduled polling, data normalization | Integrations, Jira, GitHub, GitLab, CI/CD, Jenkins, SonarQube, SAST, Deployments, Webhooks, Work Items, Scheduler |
| **Analytics Service** | DORA metrics, cycle time, WIP, deployment frequency, quality gate definitions, gate evaluation engine, pass/fail tracking, gate blocking | Metrics, Gate, GateBlock |
| **Knowledge Service** | Trace links, traceability views, RTM export, retrospectives, test cases/plans/runs, incidents, AI-DLC sessions | Traceability, Retrospectives, TestManagement, Incidents, AiDlc |

Additional cross-cutting modules: Common (Prisma, health, config, crypto, logging, notifications, filters, interceptors, middleware).

### 4.3 Persistence

- **Relational DB (PostgreSQL)** — Core entities:
  - Platform: `organizations`, `users`, `memberships`, `projects`.
  - Ingestion: `integrations`, `integration_settings`, `webhook_events`, `work_items`, `pull_requests`, `commits`.
  - CI/CD: `builds`, `deployments`.
  - Quality: `quality_reports`, `gate_definitions`, `gate_evaluations`.
  - Knowledge: `trace_links`, `retrospectives`, `test_cases`, `test_plans`, `test_runs`, `incidents`, `incident_events`.
  - AI-DLC: `ai_dlc_sessions`, `ai_dlc_artifacts`, `ai_approvals`, `ai_clarifications`.
  - Audit: `audit_logs`.
- **Cache (optional in v1)** — Redis for caching read-heavy views and session/token data.
- **Message Broker (v2)** — A message broker (e.g. NATS, Kafka, or cloud pub/sub) for async ingestion and event processing. v1 uses in-process processing with cron-based polling — sufficient for single-team scale.

## 5. Process & Deployment View

### 5.1 Runtime Flow Examples

1. **New commit & CI build**
   Developer pushes commit → Git host triggers CI pipeline → CI posts build result and test report to SDLC Hub webhook.
   Ingestion Service stores Build + TestRun, Analytics Service updates lead time / deployment frequency, evaluates quality gates.

2. **New Jira issue / status change**
   Jira webhook sends issue created/updated event → Ingestion Service normalizes to WorkItem and maps status to SDLC phase.
   Workflow Dashboard Module updates counts and WIP metrics.

### 5.2 Deployment Topology

- **Frontend** — Static assets served via CDN or behind an HTTP gateway.
- **Backend API** — Container running on Kubernetes (or other orchestration), scaled horizontally. For MVP, a single VM is acceptable.
- **Database & Cache** — Managed PostgreSQL and Redis instances.
- **Ingress & Security** — API Gateway / Ingress controller terminating TLS. Secrets stored in cloud secret manager or K8s secrets (encrypted).

## 6. Data View

High-level tables (all implemented):

- `organizations`, `users`, `memberships`, `projects`.
- `integrations`, `integration_settings`, `webhook_events`.
- `work_items` (issues, stories, tasks), `pull_requests`, `commits`.
- `builds`, `deployments`.
- `quality_reports` (SonarQube results), `gate_definitions`, `gate_evaluations`.
- `trace_links` (source_type, source_id, target_type, target_id, link_mechanism).
- `retrospectives`, `test_cases`, `test_plans`, `test_runs`.
- `incidents`, `incident_events`.
- `ai_dlc_sessions`, `ai_dlc_artifacts`, `ai_approvals`, `ai_clarifications`.
- `audit_logs`.

Indexes are added on foreign keys and frequently queried columns (project id, updated at, phase, status).

## 7. Quality Attributes & Tactics

- **Scalability** — read-optimized queries, background workers for ingestion, optional message queue.
- **Performance** — denormalized reporting tables or materialized views for heavy dashboards.
- **Security** — defense in depth (TLS everywhere, RBAC, audit logs, secret rotation).
- **Observability** — centralized logging, metrics, tracing for each integration pipeline.

### 7.1 Credential Storage & Rotation

Integration tokens and secrets are encrypted at rest using envelope encryption (AES-256-GCM):
- Application encrypts tokens with a per-environment data key.
- The data key is wrapped by a cloud KMS master key (or a local key for dev).
- Key rotation is handled by re-wrapping the data key — individual tokens are not re-encrypted unless the data key itself rotates.
- Access to the KMS is restricted to the backend API service only.

### 7.2 API Gateway & Rate Limiting

- **Inbound (webhooks)**: Signature verification + per-source rate limiting (GitHub: validate HMAC-SHA256, Jira: validate shared secret). Malformed or unverified payloads are logged and discarded.
- **Outbound (polling)**: Token-bucket rate limiter per integration, configured to stay well under each tool's API limit (e.g., GitHub 5000/hr → cap at 4000/hr). Rate limit status is surfaced in the integration health check.
- **Stale data handling**: When an integration fails after retries, the UI shows a "last synced at" timestamp with a warning indicator so users know the data may be stale. Persistent failures surface in the integration health status.

### 7.3 Ingestion Pipeline Reliability

- **Idempotency**: Every ingested event is keyed by external ID (e.g., Jira issue key + updated timestamp, GitHub event ID). Duplicate events are detected and skipped.
- **Retry strategy**: Transient failures (5xx, rate limits, DNS) retry with exponential backoff (1s, 2s, 4s, 8s, max 3 retries). Non-transient failures (4xx, invalid payloads) are logged and stored for inspection — no retry.
- **Partial ingestion**: If one integration source fails (e.g., SonarQube is down), ingestion from other sources continues unaffected. The failed source is marked as degraded.

## 8. Open Risks & Decisions

### 8.1 Active Risks

- **Design system implementation gap**: Frontend components use inline styles instead of Tailwind/CSS variable design tokens. Design tokens are defined in `packages/frontend/src/index.css` but components don't use them. Being addressed in implementation Phase 0 (see `implementation-plan.md`).

### 8.2 Future Considerations (Post-V3)

- **Service/Component entity**: Modern platforms (Backstage, Atlassian Compass) organize around services, not just projects. A project may contain multiple services, each with independent DORA metrics and quality gates. The current Project-centric model works for v1–v3 but a `Service` entity under `Project` should be evaluated if multi-service teams adopt the platform.

- **Agent-based Workflow Automation (v4)**: The Orchestration Engine introduces a new service group or module within the Knowledge Service that manages agent lifecycle, task decomposition, and parallel execution. Key architectural considerations:
  - **New database tables**: `agent_profiles`, `phase_agent_mappings`, `workflow_executions`, `workflow_tasks`, `agent_instances`, `task_dependencies`, `artifact_outputs`. These extend the existing AI-DLC schema.
  - **Integration with AI-DLC**: Agent instances create records in `ai_dlc_sessions` and `ai_dlc_artifacts`, reusing the existing approval and clarification workflows.
  - **Concurrency model**: The Orchestration Engine uses a DAG-based scheduler that evaluates the dependency graph after each task completion to determine newly eligible tasks. A configurable concurrency limit prevents resource exhaustion.
  - **Agent communication**: Agents communicate with the Orchestration Engine via REST callbacks (Completion_Callback). Heartbeat monitoring uses a polling model (agent → engine) at configurable intervals.
  - **Scalability path**: In v4 initial release, agent execution is in-process (same backend). If agent workloads grow, the architecture supports extracting agent execution to a separate worker pool communicating via the message broker (NATS/Kafka introduced in v2).
  - **Module placement**: The Orchestration Engine fits within the Knowledge Service group as it orchestrates AI-driven workflows, or may warrant a fifth service group ("Automation Service") if complexity grows beyond the Knowledge Service boundary.

### 8.3 Resolved Decisions

| Decision | Outcome | Rationale |
|---|---|---|
| API protocol (REST vs GraphQL) | REST for MVP | YAGNI — aggregated endpoints cover traceability and dashboards without GraphQL's complexity |
| Backend service count | 4 service groups | Modular monolith with proven boundaries; split later when scaling profiles diverge |
| ORM / migration tool | Prisma | Type-safe queries, clean migration workflow, good NestJS compatibility |
| Retrospectives in v1 | Deferred to v1.1 | Standalone CRUD with no integration dependencies; frees capacity for quality gates |
| Credential storage | Envelope encryption via cloud KMS | Standard pattern for token-at-rest protection; separates data keys from master keys |
| Frontend framework | React 19 | Confirmed during v1 implementation |
| CSS framework | Tailwind CSS v4 | Installed with design tokens defined as CSS variables in `packages/frontend/src/index.css` |
| Multi-tenant vs single-tenant | Single-tenant for v1 | Multi-tenant foundations deferred to v2 |
| Backend modules beyond v1 scope | All implemented | GitLab, Jenkins, SAST, Retrospectives, Test Management, Incidents, AI-DLC, Notifications — backend APIs and database models are in place |
