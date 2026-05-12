# SDLC Hub — Consolidated Product Requirements

> **Document status**: Living document. Supersedes all prior requirements docs and implementation plans.
> **Last updated**: 2026-05-09
> **Versioning**: v1 = MVP · v2 = Platform expansion · v3 = Test management + Incident tracking · v4 = Deferred (templates, automation)

---

## 1. Purpose & Vision

SDLC Hub is a unified visibility and governance platform for the full Software Development Life Cycle — from requirement through code, test, deployment, and production operations. It does not replace existing tools; it integrates with them (Jira, GitHub, CI/CD, SonarQube, PagerDuty) to surface actionable insights, enforce quality standards, and close the feedback loop between delivery and operations.

**Core value proposition:**
- One place to see the health of every project across the entire delivery chain.
- Deterministic traceability from requirement to incident — no guesswork.
- Quality gates that enforce standards consistently, not just document them.
- Metrics that reflect real delivery performance (DORA + flow + test + incident).

---

## 2. Goals by Version

| Goal | v1 | v2 | v3 |
|---|---|---|---|
| Unified SDLC view (planning → deployment) | ✓ | ✓ | ✓ |
| Reduce lead time via bottleneck identification | ✓ | ✓ | ✓ |
| Enforce quality gates consistently | Advisory | Hard-block | ✓ |
| Full requirement → incident traceability | Partial | Extended | ✓ |
| Close the testing gap (test management) | — | Partial | ✓ |
| Close the production feedback loop (incidents) | — | — | ✓ |
| Multi-language UI (EN / JA / VI) | EN only | EN only | ✓ |
| Multi-tenant SaaS readiness | — | Foundations | ✓ |

---

## 3. Scope & Version Boundaries

| Feature Area | v1 MVP | v2 | v3 |
|---|---|---|---|
| Auth (JWT + SSO/OIDC) | JWT | SSO | ✓ |
| Organizations & projects | ✓ | ✓ | ✓ |
| Jira integration | ✓ | ✓ | ✓ |
| GitHub + GitHub Actions integration | ✓ | ✓ | ✓ |
| SonarQube integration | ✓ | ✓ | ✓ |
| GitLab + Jenkins integration | — | ✓ | ✓ |
| SAST / SCA scanners | — | ✓ | ✓ |
| PagerDuty integration | — | — | ✓ |
| SDLC workflow (Kanban, phases, status mapping) | ✓ | ✓ | ✓ |
| Quality gates (advisory) | ✓ | — | — |
| Quality gates (hard-block + approval workflows) | — | ✓ | ✓ |
| DORA metrics (deployment frequency, lead time) | ✓ | ✓ | ✓ |
| Flow metrics (WIP, cycle time) | ✓ | ✓ | ✓ |
| Traceability (Epic → Story → PR → Build → Deploy) | ✓ | Extended | ✓ |
| Traceability (→ Test Case → Test Run → Incident) | — | — | ✓ |
| RTM export (CSV / Excel) | — | ✓ | ✓ |
| Retrospective Knowledge Hub | — | ✓ | Extended |
| Full test management (cases, plans, runs, CI ingest) | — | Partial | ✓ |
| Incident tracking + MTTR / CFR metrics | — | — | ✓ |
| Slack / Teams notifications | — | ✓ | ✓ |
| Advanced RBAC | — | ✓ | ✓ |
| Multi-tenant foundations | — | ✓ | ✓ |
| i18n (EN / JA / VI) | EN only | EN only | ✓ |
| SDLC model templates | — | — | v4 |
| Feasibility analysis module | — | — | v4 |
| Workflow automation engine (Agent-based) | — | — | v4 |
| Service/Component entity (multi-service projects) | — | — | v4 |

### v4 Deferred Features — Agent-based Workflow Automation

The v4 "Workflow automation engine" is scoped as an **Agent-based Workflow Automation** system. Key capabilities:

- **Agent Profile Registry**: Define AI agent profiles per role (BA, Dev, QA, DevOps) with skill sets and supported SDLC phases.
- **SDLC Phase-to-Agent Mapping**: Map each configurable workflow phase to one or more agent profiles, so the system knows which agent to start when a phase begins.
- **Orchestration Engine**: Automatically decompose workflow tasks by SDLC step, build a dependency graph (DAG), and assign tasks to the appropriate agents.
- **Parallel Execution**: Tasks without dependencies execute concurrently (e.g., Dev and QA agents producing documents simultaneously).
- **Agent Lifecycle Management**: Track agent instances through states (pending → starting → running → done/failed/timed_out) with heartbeat monitoring and retry logic.
- **Completion Callbacks**: Agents report task completion with artifacts; the engine evaluates downstream dependencies and notifies stakeholders.
- **Artifact Output Management**: Store deliverables (documents, code, test plans) produced by agents, linked to the existing `ai_dlc_artifacts` table.
- **AI-DLC Integration**: Builds on top of the existing AI-DLC module tables (`ai_dlc_sessions`, `ai_dlc_artifacts`, `ai_approvals`, `ai_clarifications`).

Full requirements are documented in `.kiro/specs/agent-workflow-automation/requirements.md`.

---

**Permanently out of scope:**
- Full project management (sprint planning, burndown charts, story point estimation) — defer to Jira.
- In-app source code editor or CI/CD engine — integrate only, never replace.
- On-prem installation automation.

---

## 4. User Roles & Permissions

| Role | Scope | Key Capabilities |
|---|---|---|
| **Org Admin** | Organization | Manage org settings, identity providers, billing, member roles |
| **Project Owner** | Project | Create projects, configure integrations, define workflow phases and quality gates |
| **Developer** | Project | View dashboards and Kanban, own issues/PRs, respond to gate failures |
| **QA Engineer** *(v3)* | Project | Manage test cases, test plans, test runs; triage defects |
| **DevOps / SRE** *(v3 expanded)* | Project | Manage pipelines, release approvals, deployments, incidents |
| **Read-only** *(v2)* | Project | View dashboards and reports; no write access |

RBAC is enforced at both organization and project level. Fine-grained permission scoping by module and action type is a v2 requirement.

---

## 5. Core Use Cases

### UC-1: Connect a project to SDLC Hub
As a **Project Owner**, I configure integrations (Jira, GitHub, CI/CD, SonarQube) for a project, verify connectivity, and see health status on the settings page.

### UC-2: Visualize the SDLC workflow
As a **team**, we see our issues and pull requests moving through configurable SDLC phases (e.g., Planning → Dev → Review → Test → Release → Production) on a Kanban board, with WIP counts and aging indicators.

### UC-3: Define and enforce quality gates
As a **Project Owner**, I define quality gates per phase (e.g., "coverage ≥ 80%", "no critical SonarQube issues", "integration-tests CI check must pass") and the system blocks phase progression when gates fail.

### UC-4: Trace requirement to deployment
As a **stakeholder**, I trace any Jira Epic to all its downstream artifacts — stories, PRs, builds, deployments — and see the current status of each hop.

### UC-5: Manage test cases and track coverage *(v3)*
As a **QA Engineer**, I create test cases linked to requirements, organize them into test plans, record manual and CI-automated test runs, and view test coverage per requirement and per release.

### UC-6: Track production incidents and measure recovery *(v3)*
As an **SRE**, I log production incidents (or ingest them from PagerDuty), link them to the deployment or commit that caused them, and track MTTR and Change Failure Rate on the metrics dashboard.

### UC-7: Run a post-mortem retrospective *(v2/v3)*
As a **team**, we create a retrospective entry per project, capture what went well and what didn't, assign action items with owners and due dates, and — for incidents — link the retro directly to the triggering incident.

### UC-8: Export a Requirements Traceability Matrix *(v2/v3)*
As a **stakeholder or auditor**, I request an RTM export (CSV or Excel) showing the full chain: requirement → test case → test run → result. The export runs as a background job and delivers a download link when ready.

### UC-9: Automate SDLC workflow with role-based agents *(v4)*
As a **Project Owner**, I configure agent profiles (BA, Dev, QA, DevOps) mapped to SDLC phases, then start a workflow execution. The orchestration engine automatically decomposes work into tasks, starts the appropriate agent for each step, runs independent tasks in parallel, and notifies me when each agent completes its deliverables.

---

## 6. Functional Requirements

### 6.1 Authentication & Authorization

- **FR-AUTH-1**: System shall support email/password authentication with JWT-based sessions (v1).
- **FR-AUTH-2**: System shall support SSO via OAuth2/OIDC (Azure AD, Google, GitHub) (v2).
- **FR-AUTH-3**: System shall enforce role-based access control (RBAC) at organization and project level (v1 basic; v2 fine-grained).
- **FR-AUTH-4**: System shall produce audit logs for login events, project changes, integration changes, and permission changes (v1 basic; v2 expanded).

### 6.2 Organization & Project Management

- **FR-ORG-1**: System shall allow users to create organizations with name, key, and description.
- **FR-ORG-2**: System shall allow Org Admins to add members to an organization with a role.
- **FR-PROJ-1**: System shall allow Org Admins and Project Owners to create projects with name, key, description, and time zone.
- **FR-PROJ-2**: System shall list all projects within an organization with pagination.
- **FR-PROJ-3**: System shall show a project detail view with integration health, recent activity, and key metrics.

### 6.3 Integration Management

- **FR-INT-1**: System shall support configuring multiple integrations per project:
  - Issue tracker: Jira REST API (v1); GitLab Issues (v2).
  - Source control: GitHub (v1); GitLab (v2).
  - CI/CD: GitHub Actions (v1); GitLab CI, Jenkins (v2).
  - Quality tools: SonarQube (v1); SAST/SCA scanners (v2).
  - Incident management: PagerDuty (v3).
- **FR-INT-2**: System shall validate integration connectivity on save and expose a health-check endpoint per integration.
- **FR-INT-3**: System shall display integration health status and last-synced timestamp on the project settings page. Stale or degraded integrations shall show a warning indicator.
- **FR-INT-4**: System shall receive data from external tools via webhooks (GitHub events, Jira events, CI build results, PagerDuty alerts).
- **FR-INT-5**: System shall poll external APIs on a configurable schedule when webhooks are unavailable or unreliable.
- **FR-INT-6**: Integration tokens and secrets shall be stored encrypted at rest using envelope encryption (application-layer encryption + cloud KMS).

### 6.4 SDLC Workflow & Kanban

- **FR-WF-1**: System shall provide configurable SDLC workflow phases per project (name, order, color). Default phases: Idea → Ready for Dev → In Dev → In Review → In Test → Ready for Release → In Production.
- **FR-WF-2**: System shall allow mapping issue tracker statuses (e.g., Jira status) to SDLC phases via a mapping UI. Mappings shall be applied retroactively to existing work items on demand.
- **FR-WF-3**: System shall display a Kanban board showing work items grouped by SDLC phase, with item count per phase and total WIP.
- **FR-WF-4**: Kanban board shall support filtering by assignee, label, sprint, and type.
- **FR-WF-5**: System shall show throughput metrics (items completed per phase per time window) and aging WIP (items in a phase beyond a configurable threshold).

### 6.5 Quality Gates & DevSecOps

- **FR-GATE-1**: System shall allow defining quality gates per workflow phase with the following rule types:
  - Minimum code coverage percentage.
  - Maximum allowed critical/blocker issues from quality tools.
  - Mandatory CI check results (named check must pass).
- **FR-GATE-2**: System shall ingest build results and quality reports from CI/CD and quality tools via webhooks and APIs.
- **FR-GATE-3**: System shall evaluate gates automatically when a new build or quality report is ingested.
- **FR-GATE-4**: System shall display pass/fail gate status per PR and per build.
- **FR-GATE-5**: Gate enforcement shall be advisory in v1 (warning only) and hard-block in v2 (blocks phase progression until gate passes or is overridden with approval).
- **FR-GATE-6** *(v2)*: System shall support per-phase approval workflows for release readiness, requiring designated approvers to sign off before promotion.
- **FR-GATE-7** *(v2)*: System shall support "Policy as Code" — reading gate configuration from a `.sdlc-hub.yaml` file in the project repository, enabling gate changes to be audited via Git history.

### 6.6 Traceability

The traceability chain uses deterministic linking mechanisms at every hop — no heuristics.

| Hop | Source → Target | Linking Mechanism | Version |
|---|---|---|---|
| 1 | Epic → Story | Jira API `parent` field | v1 |
| 2 | Story → PR | Regex extract issue key from PR branch name (e.g., `PROJ-123-fix-bug`). PRs with unparseable branch names appear in an "Unlinked PRs" view for manual mapping. | v1 |
| 3 | PR → Build | GitHub Actions `pull_request` event payload (PR number) | v1 |
| 4 | Build → Deployment | GitHub Actions `deployment` event or `workflow_run` with environment tag | v1 |
| 5 | Requirement → Test Case | Manual link in test case form + bulk-link by requirement key | v3 |
| 6 | Test Case → Test Run | Foreign key relationship | v3 |
| 7 | Deployment → Incident | Manual link or auto-link via PagerDuty metadata | v3 |

> **Implementation note**: Hops 1–4 are fully implemented. Hops 5–7 (v3 traceability extensions: Test Case, Test Run, Incident) have backend models and APIs implemented; frontend pages exist but need design system application.

- **FR-TRACE-1**: System shall support a traceability view for any requirement (Jira Epic), listing all linked artifacts and their current status at each hop.
- **FR-TRACE-2**: System shall support creating and deleting manual trace links between any two artifact types.
- **FR-TRACE-3**: System shall surface unlinked artifacts (PRs with unparseable branch names, deployments with no linked incident) in a dedicated "Unlinked" view for manual resolution.
- **FR-TRACE-4** *(v2)*: System shall provide a traceability coverage view highlighting gaps: requirements with no test cases, deployments with no incidents, stories with no PRs.
- **FR-TRACE-5** *(v2)*: System shall generate a Requirements Traceability Matrix (RTM) export as CSV and Excel. Export runs as an async background job; user receives an in-app notification with a download link when ready.

### 6.7 Metrics & Analytics

- **FR-METRICS-1**: System shall compute and display DORA metrics per project:
  - **Deployment Frequency** — deployments per time window.
  - **Lead Time for Changes** — time from first commit to production deployment.
  - **Change Failure Rate** *(v3)* — deployments causing incidents / total deployments.
  - **MTTR** *(v3)* — mean time to recovery per service (avg, p50, p90 over configurable windows).
- **FR-METRICS-2**: System shall compute and display flow metrics:
  - WIP per phase.
  - Cycle time per phase.
  - Throughput (items completed per phase per time window).
  - Aging WIP (items exceeding a configurable age threshold per phase).
- **FR-METRICS-3** *(v3)*: System shall compute and display test metrics:
  - Test coverage % per requirement and per release.
  - Defect escape rate (bugs found in production vs. in testing).
- **FR-METRICS-4** *(v2)*: System shall provide trend views for gate failure rate, failed build rate, and cycle-time distribution over time.

### 6.8 Test Management *(v3)*

- **FR-TEST-1**: System shall allow creating and managing test cases per project with: title, description, preconditions, steps, expected result, priority (Critical/High/Medium/Low), and type (Unit/Integration/E2E/Performance/Security).
- **FR-TEST-2**: System shall allow linking test cases to requirements or user stories from Jira.
- **FR-TEST-3**: System shall support test plans that group test cases for a release or sprint.
- **FR-TEST-4**: System shall allow recording test runs (manual or CI-automated) with a result per test case: Pass / Fail / Blocked / Skip.
- **FR-TEST-5**: System shall ingest automated test results from CI pipelines via JUnit XML and JSON report formats. Test case matching uses a three-tier fallback:
  1. Exact name match (primary).
  2. Tag-based match (test case tagged with `#<test_suite_name>`).
  3. Manual mapping override when auto-match fails. Unmatched results are flagged in the UI.
- **FR-TEST-6**: System shall allow linking a failed test run to a defect issue in Jira or GitHub Issues, and track defect resolution status.
- **FR-TEST-7**: System shall display test coverage % per requirement and per release.
- **FR-TEST-8**: System shall provide an in-app RTM table view (Requirement → Test Case → Test Run → Result) and an async export to CSV and Excel (PDF deferred to v4).

### 6.9 Incident Tracking *(v3)*

- **FR-INC-1**: System shall allow logging incidents with: title, severity (P1–P4), start time, end time, affected service, linked deployment/commit (root cause), and a timeline of events and resolution steps.
- **FR-INC-2**: System shall integrate with PagerDuty to ingest alerts and resolved incidents automatically via webhook. Alert deduplication uses external alert ID within a 5-minute window.
- **FR-INC-3**: System shall compute MTTR (avg, p50, p90) per service per configurable time window.
- **FR-INC-4**: System shall compute Change Failure Rate = incidents linked to deployments / total deployments.
- **FR-INC-5**: System shall allow linking a resolved incident to a retrospective for post-mortem capture. The retrospective entry shall pre-fill with incident details, timeline, and root cause notes.

### 6.10 Retrospective Knowledge Hub *(v2)*

- **FR-RETRO-1**: System shall allow creating retrospective entries per project with: title, sprint/time range, participants, what went well, what went wrong, and action items.
- **FR-RETRO-2**: System shall allow tagging retrospectives with project type, tech stack, and SDLC phase(s) involved.
- **FR-RETRO-3**: System shall support action item tracking with owner, due date, and completion status.
- **FR-RETRO-4**: System shall allow linking a retrospective to an incident for post-mortem workflow.
- **FR-RETRO-5** *(v2)*: System shall provide search across retrospectives and recommend similar retros when creating a new project (based on tags, tech stack, and issue patterns).

### 6.11 Notifications & Collaboration *(v2)*

- **FR-NOTIF-1**: System shall send notifications for gate failures, deployment events, and retro action item reminders via Slack and Microsoft Teams.
- **FR-NOTIF-2**: System shall support in-app notifications for async job completions (RTM export, large ingestion jobs).
- **FR-NOTIF-3**: System shall support user mentions and watchers on retrospectives, projects, and quality incidents.

### 6.12 Internationalization

- **FR-I18N-1**: All UI text shall be externalized into locale files from the start of development (v1). This avoids costly refactoring later.
- **FR-I18N-2** *(v3)*: UI shall be fully available in English, Japanese, and Vietnamese.
- **FR-I18N-3** *(v3)*: All date/time and number formatting shall be locale-aware.

### 6.13 Agent-based Workflow Automation *(v4)*

- **FR-AGENT-1**: System shall support defining agent profiles with: name, role (BA/Dev/QA/DevOps/Designer/SRE), description, skill set, and supported SDLC phases.
- **FR-AGENT-2**: System shall provide default agent profiles (BA_Agent, Dev_Agent, QA_Agent, DevOps_Agent) available to all projects without manual configuration.
- **FR-AGENT-3**: System shall allow mapping one or more agent profiles to each SDLC workflow phase per project (Phase-to-Agent Mapping).
- **FR-AGENT-4**: System shall provide an Orchestration Engine that decomposes a workflow execution into individual tasks based on SDLC phases and Phase-to-Agent Mappings.
- **FR-AGENT-5**: The Orchestration Engine shall generate a dependency graph (DAG) for all tasks within a workflow execution, identifying execution order constraints.
- **FR-AGENT-6**: Tasks with no unresolved dependencies shall execute in parallel. The system shall enforce a configurable maximum concurrency limit per workflow execution.
- **FR-AGENT-7**: The Orchestration Engine shall manage agent instances through lifecycle states: pending → starting → running → done / failed / timed_out.
- **FR-AGENT-8**: When an agent instance completes, it shall send a completion callback containing: task ID, status (done/failed), artifact outputs, and execution duration.
- **FR-AGENT-9**: When a task completes, the Orchestration Engine shall re-evaluate the dependency graph and start any newly unblocked downstream tasks.
- **FR-AGENT-10**: System shall store artifact outputs (documents, code, test plans) produced by agents, linked to the existing `ai_dlc_artifacts` table.
- **FR-AGENT-11**: System shall provide a real-time monitoring dashboard showing task states, dependency graph visualization, and critical path highlighting.
- **FR-AGENT-12**: System shall allow Project Owners to start, pause, resume, and cancel workflow executions.
- **FR-AGENT-13**: Agent workflow automation shall integrate with the existing AI-DLC module — creating records in `ai_dlc_sessions`, `ai_dlc_artifacts`, `ai_approvals`, and `ai_clarifications`.
- **FR-AGENT-14**: When an agent fails or times out, the system shall notify the Project Owner and optionally retry up to a configurable limit.

---

## 7. Non-Functional Requirements

### 7.1 Performance & Scalability

- **NFR-1**: Dashboard pages shall load in under 2 seconds for typical queries at p95.
- **NFR-2**: The ingestion pipeline shall handle at least 10,000 issues/PRs/builds per day without degradation.
- **NFR-3** *(v3)*: CI test result ingestion shall handle up to 5,000 test cases per build without blocking the ingestion pipeline.
- **NFR-4** *(v3)*: RTM export for projects with up to 1,000 requirements shall complete within 2 minutes as an async background job.

### 7.2 Availability & Reliability

- **NFR-5**: Target availability: 99.5% monthly (v1); 99.9% (v2+).
- **NFR-6**: System shall provide daily backups of all critical data with a minimum 30-day retention period.
- **NFR-7**: Ingestion pipeline shall be idempotent — every event is keyed by external ID; duplicate events are detected and skipped.
- **NFR-8**: Transient ingestion failures shall retry with exponential backoff (1s → 2s → 4s → 8s, max 3 retries). Non-transient failures (4xx, invalid payloads) are logged and stored for inspection without retry.
- **NFR-9**: If one integration source fails, ingestion from other sources continues unaffected. The failed source is marked as degraded with a "last synced at" warning in the UI.

### 7.3 Security & Compliance

- **NFR-10**: All traffic shall be encrypted via HTTPS/TLS.
- **NFR-11**: Integration tokens and secrets shall be stored encrypted at rest using envelope encryption (application key + cloud KMS master key).
- **NFR-12**: Inbound webhooks shall be verified using provider-specific signatures (GitHub: HMAC-SHA256; Jira: shared secret). Unverified payloads are logged and discarded.
- **NFR-13**: Outbound API polling shall use a token-bucket rate limiter per integration, configured to stay below each provider's rate limit (e.g., GitHub: cap at 4,000/hr against a 5,000/hr limit).
- **NFR-14**: System shall produce audit logs for: login, project changes, integration changes, permission changes, and gate overrides.

### 7.4 Testing Strategy

- **NFR-15**: External API clients (Jira, GitHub, SonarQube, PagerDuty) shall have contract tests using recorded fixtures — no live API calls in CI.
- **NFR-16**: Ingestion pipeline shall have integration tests against an ephemeral database (testcontainers or equivalent).
- **NFR-17**: API endpoints shall have integration tests covering the happy path and the most likely failure mode per endpoint.
- **NFR-18**: Frontend shall have component tests (Testing Library) and at least one end-to-end smoke test per critical user flow (Cypress or Playwright).
- **NFR-19** *(v3)*: PagerDuty incident ingestion shall deduplicate alerts within a 5-minute window, verified by integration tests.

### 7.5 Agent Workflow Automation *(v4)*

- **NFR-20** *(v4)*: The Orchestration Engine shall support at least 10 concurrent agent instances per workflow execution without degradation.
- **NFR-21** *(v4)*: Agent startup latency (from task assignment to "running" state) shall be under 5 seconds at p95.
- **NFR-22** *(v4)*: Completion callbacks shall be processed within 1 second of receipt, triggering downstream task evaluation immediately.
- **NFR-23** *(v4)*: The dependency graph evaluation (identifying newly eligible tasks) shall complete in under 100ms for workflows with up to 50 tasks.
- **NFR-24** *(v4)*: Agent heartbeat monitoring shall detect failed agents within 2× the configured heartbeat interval.

---

## 8. Architecture Constraints

These constraints are fixed for v1–v3 and should only be revisited with an ADR.

| Constraint | Decision | Rationale |
|---|---|---|
| Backend framework | NestJS (Node.js) | Modular monolith with clear service boundaries |
| Frontend framework | React 19 SPA | Confirmed during v1 implementation |
| Database | PostgreSQL + Prisma ORM | Type-safe queries, clean migrations, good NestJS compatibility |
| API protocol | REST (v1–v3) | YAGNI — aggregated endpoints cover complex views without GraphQL overhead |
| Deployment | Containerized (Kubernetes-ready) | Single VM acceptable for MVP; horizontal scaling for v2+ |
| Auth protocol | JWT (v1); OAuth2/OIDC (v2) | Standard; SSO deferred until multi-team adoption |
| Credential storage | Envelope encryption via cloud KMS | Separates data keys from master keys; supports key rotation |
| Message broker | In-process + cron (v1); NATS/Kafka/cloud pub-sub (v2) | Introduced in v2 when ingestion volume justifies async decoupling |

---

## 9. Key Design Decisions & Rationale

### 9.1 Modular Monolith (v1–v3)
Four internal services with clear ownership boundaries: **Platform** (auth, orgs, projects, workflow), **Ingestion** (adapters, webhooks, polling), **Analytics** (metrics, gates), **Knowledge** (traceability, retros, test management, incidents). Services share a database but access each other only through service interfaces, not direct DB queries. Split into microservices only when scaling profiles diverge.

### 9.2 Deterministic Traceability
Every trace link uses a deterministic mechanism. Heuristic or AI-based linking is explicitly rejected for v1–v3 to ensure auditability. The "Unlinked PRs" view handles the fallback case where branch naming conventions are not followed. Traceability hops 5–7 (Test Case, Test Run, Incident) are v3 additions — backend models and APIs are implemented; frontend pages exist but need design system application.

### 9.3 i18n from Day One
The i18n framework (i18next) and locale file structure shall be set up in Sprint 1 of v1, not deferred. Retrofitting hard-coded strings across a completed codebase is significantly more expensive than building with externalized strings from the start.

### 9.4 Async Exports
Any export or report generation that could exceed 30 seconds (RTM export, large analytics reports) shall run as a background job. The user receives an in-app notification with a download link when the job completes. This prevents API timeouts and avoids database spikes from synchronous large queries.

### 9.5 Policy as Code (v2)
Quality gate definitions shall support reading from a `.sdlc-hub.yaml` file in the project repository. This allows teams to version-control their quality standards and audit changes through Git history, in addition to the UI-based configuration.

---

## 10. Open Questions

| # | Question | Owner | Target |
|---|---|---|---|
| OQ-1 | Maximum projects and users per organization for infrastructure sizing? | Product | Before v2 launch |
| OQ-2 | Single-tenant vs. multi-tenant SaaS hosting model? | Product / Infra | Before v2 launch |
| OQ-3 | CI test report formats: JUnit XML only, or also JSON (Jest, Playwright)? | Engineering | Sprint V3-1 |
| OQ-4 | Maximum test cases per project for performance sizing? | Engineering | Sprint V3-1 |
| OQ-5 | GitHub App vs. OAuth token for source control integration? (App provides richer metadata for traceability) | Engineering | Before v2 |
| OQ-6 | shadcn/ui initialization for frontend — Tailwind CSS v4 is installed and design tokens are defined as CSS variables in `index.css`, but shadcn/ui has not been initialized. Current components use inline styles instead of Tailwind classes. | Engineering | Phase 0 (see implementation-plan.md) |

### Resolved

| Decision | Outcome |
|---|---|
| v1 integrations | Jira + GitHub + GitHub Actions + SonarQube. GitLab, Jenkins, SAST/SCA deferred to v2. |
| Incident ingestion | PagerDuty for v3. Opsgenie deferred to future version. |
| RTM export mechanism | Async background job with in-app notification. |
| Retrospectives in v1 | Deferred to v1.1 (standalone CRUD, no integration dependencies). |
| Credential storage | Envelope encryption via cloud KMS. |
| API protocol | REST for v1–v3. GraphQL deferred. |
| Frontend framework | React 19 — selected and deployed. |
| CSS framework | Tailwind CSS v4 — installed with design tokens defined as CSS variables in `packages/frontend/src/index.css`. |
| Backend modules beyond v1 | GitLab, Jenkins, SAST, Retrospectives, Test Management, Incidents, AI-DLC — all implemented with backend APIs and database models. |

---

## 11. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Branch naming convention not followed → broken Story→PR links | High | Medium | "Unlinked PRs" view for manual mapping; consider GitHub App metadata as a richer alternative to regex in v2. |
| GitHub/Jira API rate limits hit during bulk sync | Medium | High | Token-bucket rate limiter per integration; cache layer; exponential backoff on 429 responses. |
| Duplicate ingestion events causing data inconsistency | Medium | High | Idempotency key on every ingested event (external ID + updated timestamp). |
| CI test result matching is brittle (test names change) | High | Medium | Three-tier fallback (exact name → tag → manual override); spike in Sprint V3-1 before committing to implementation. |
| PagerDuty alert storms creating noise | Medium | Medium | Deduplicate by external alert ID within 5-minute window; severity filtering (ingest P1–P3 only). |
| RTM export timeouts on large projects | Medium | Medium | Async background job; paginated in-app view; 2-minute SLA for 1,000 requirements. |
| i18n maintenance burden (3 languages) | Low | Medium | Translation keys default to English when missing; CI lint check warns on missing keys but does not block merge. |
| Project-centric model limits multi-service teams | Low | Low (v1–v3) | Evaluate `Service` entity under `Project` in v4 if multi-service adoption grows. |
| Design system implementation gap — components use inline styles instead of Tailwind/CSS tokens | High | Medium | Addressed in implementation Phase 0 (see implementation-plan.md). Design tokens are defined; components need to adopt them. |
| Agent orchestration complexity — DAG scheduling, parallel execution, failure recovery | Medium | High | Start with simple sequential + parallel model; defer complex DAG features. Configurable concurrency limits prevent runaway resource usage. |
| Agent reliability — agents may hang, crash, or produce invalid artifacts | Medium | High | Heartbeat monitoring + configurable timeouts + retry limits. Failed agents are logged and Project Owner is notified. |
| Agent resource exhaustion — too many concurrent agents per project | Low | High | Configurable max concurrency per workflow execution. Default conservative limit (e.g., 5 concurrent agents). |
