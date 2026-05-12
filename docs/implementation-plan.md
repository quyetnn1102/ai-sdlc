# SDLC Hub — Implementation Plan

> **Status**: Active. Supersedes `IMPLEMENTATION_PLAN.md`, `IMPLEMENTATION_PLAN_V2.md`, `IMPLEMENTATION_PLAN_V3.md`.
> **Last updated**: 2026-05-09
> **Source**: Extracted from gap analysis of actual codebase state (May 2026)

---

## 1. Current State Summary

**Backend**: The NestJS backend is in good shape. All four service groups (Platform, Ingestion, Analytics, Knowledge) are implemented. The Prisma schema covers v1 through v3 data models. The ingestion pipeline (Jira, GitHub, GitLab, CI/CD, Jenkins, SonarQube, SAST) is operational. v3 features (Test Management, Incidents, AI-DLC) have complete backend APIs and database models.

Known backend gaps: webhook processing is a stub (receives events but doesn't process them), some schema fields are missing (Incident `startAt`/`endAt`, Retrospective `participants`), MTTR calculation is simplified, and audit logging is not wired up.

**Frontend**: This is the critical gap. The frontend has functional pages for all routes but:
- No design system adoption — components use inline styles instead of Tailwind/CSS tokens
- Design tokens are defined in `index.css` but not used by components
- shadcn/ui is not initialized
- Some v1 pages are missing (Traceability, Metrics, Retrospectives)
- Existing pages lack features (Kanban filters, status mapping UI, integration health badges)

---

## 2. Design System Review & Adjustments

The design system spec (`design-system.md`) is well-structured. These adjustments are needed before implementation:

### Keep as-is
- Color palette (Linear-inspired dark, blue-indigo accent)
- Typography scale (Inter, 11px–32px)
- Spacing grid (4px base)
- Component specs (Sidebar, Kanban, Metric Cards, Gate Badge, Table, Buttons)
- Dark-only for MVP

### Adjustments needed
- **shadcn/ui initialization**: Tailwind CSS v4 is installed but `npx shadcn@latest init` has not been run. shadcn/ui provides Radix-based accessible primitives (Dialog, Select, Tooltip, etc.).
- **CSS custom properties approach**: Design tokens are defined as CSS variables in `index.css`. Components need to use them instead of inline styles.
- **`font-variant-numeric: tabular-nums`**: Needs to be applied globally to metric number displays.

---

## 3. Phased Implementation Plan

Work is split into phases. Each phase is independently shippable.

---

### Phase 0 — Design System Foundation (blocks everything else)

**Goal**: Replace inline styles with the SDLC Hub design system. Initialize shadcn/ui. Create shared components.

**P0-1: Initialize shadcn/ui**
```bash
# in packages/frontend
npx shadcn@latest init
```
- Style: Default, Base color: Slate, CSS variables: Yes

**P0-2: Verify design tokens in `index.css`**
- Confirm all CSS custom properties match the design system spec
- Ensure Tailwind v4 `@theme` block maps design tokens to Tailwind classes

**P0-3: Rebuild `Shell.tsx` (Sidebar)**
- 240px sidebar, `--bg-surface` background, `--border-subtle` right border
- Organization name at top
- Nav items with active state (accent-subtle bg + 2px accent-primary left indicator)
- Settings + Logout at bottom

**P0-4: Create/update shared UI components** in `src/components/ui/`
- `Button.tsx` — primary / secondary / danger / ghost variants using Tailwind classes
- `Badge.tsx` — gate status badge (pass/fail/warning/pending)
- `Card.tsx` — surface card with optional header
- `Input.tsx` / `Select.tsx` — styled form controls
- `Table.tsx` — data table with header, rows, hover state
- `Skeleton.tsx` / `Spinner.tsx` — loading states
- `PageHeader.tsx` — page title + breadcrumb + action slot

**P0-5: Update i18n locale file**
- Add missing translation keys for all pages

**Deliverable**: App shell matches the design spec. All existing pages still work (restyled).

---

### Phase 1 — Restyle Existing Pages

**Goal**: Apply the design system to all existing functional pages without changing behavior.

**P1-1: Login & Register** — centered card on `--bg-app`, styled inputs and primary button

**P1-2: Dashboard** — 4 DORA metric cards, recent activity placeholder

**P1-3: Organization List & Create** — Table component for org list, styled form

**P1-4: Organization Detail** — two-column layout (projects left, members right)

**P1-5: Project Detail** — metric strip (4 DORA cards), project nav tabs, gate status summary

**P1-6: Kanban Board** — 280px columns, `--bg-elevated` cards, phase color header, item count badge

**P1-7: Workflow Page** — phase cards in order, status mapping UI (Jira status → phase mappings)

**P1-8: Gates Page** — gate list as data table, pass/fail badge, evaluation result panel

**P1-9: Settings Page** — integration cards with health status badge, last-synced timestamp, "Test Connection" button

**Deliverable**: All existing pages match the design system. No new features.

---

### Phase 2 — Missing v1 Pages

**Goal**: Add pages that are missing from the frontend but have backend APIs ready.

**P2-1: Traceability Page** (`/projects/:id/trace`)
- Requirement search input (enter epic key)
- Trace chain visualization: Epic → Stories → PRs → Builds → Deployments
- Each hop shows status badge
- "Unlinked PRs" section at bottom

**P2-2: Metrics Page** (`/projects/:id/metrics`)
- 4 DORA metric cards (deployment freq, lead time, failure rate, MTTR)
- Flow metrics table (WIP per phase, avg age, throughput 7d)
- Period selector (7d / 30d / 90d)

**P2-3: Retrospectives Page** (`/projects/:id/retros`)
- List of retros as cards (title, sprint, date, tag chips)
- Create retro form (title, sprint, what went well / wrong / action items)
- Edit / delete

**P2-4: Add project nav links** for Traceability, Metrics, Retros to project detail nav tabs

**Deliverable**: All v1 use cases have a UI.

---

### Phase 3 — Backend Fixes

**Goal**: Fix the backend gaps to reach production quality for v1 scope.

**P3-1: Webhook processing** — implement actual event handling in `WebhooksController`:
- GitHub: parse `push`, `pull_request`, `workflow_run`, `deployment` events
- Jira: parse `jira:issue_created`, `jira:issue_updated` events
- Add HMAC-SHA256 signature verification for GitHub webhooks

**P3-2: Schema migration** — add missing fields:
- `Incident`: `startAt`, `endAt`, `affectedService`, `rootCauseCommitId`
- `Retrospective`: `participants` (JSON), `incidentId`
- `TestCase`: `preconditions`, `linkedRequirementId`

**P3-3: Fix MTTR calculation** — use `startAt`/`endAt` fields, add p50/p90

**P3-4: Audit log writes** — add log entries in auth, project, integration, and gate services

**P3-5: Fix N+1 in `getRequirementTrace`** — rewrite with a single aggregated query

**P3-6: RTM export endpoint** — `GET /api/projects/:id/rtm` (in-app view) + `POST /api/projects/:id/rtm/export` (async job stub)

**Deliverable**: Backend is production-quality for v1 scope.

---

### Phase 4 — v3 Feature Pages (Test Management + Incidents)

**Goal**: Add UI for the v3 features that already have backend APIs.

**P4-1: Test Cases Page** (`/projects/:id/tests`)
- Table of test cases with priority badge, type badge, linked requirement
- Create test case form (title, description, preconditions, steps, expected result, priority, type)
- Link to requirement (text input for Jira issue key)

**P4-2: Test Plans Page** (`/projects/:id/test-plans`)
- List of test plans with status badge
- Create test plan (name, sprint/release, select test cases)
- Test plan detail: list of test cases with result input (Pass/Fail/Blocked/Skip)

**P4-3: Incidents Page** (`/projects/:id/incidents`)
- Table of incidents with severity badge (P1–P4), status badge
- Create incident form (title, severity, start time, affected service, linked deployment)
- Incident detail: timeline, root cause, link to retrospective

**P4-4: Add nav links** for Tests, Test Plans, Incidents to project navigation

**Deliverable**: All v3 use cases have a UI.

---

## 4. Recommended Execution Order

```
Phase 0 (Design System)  -->  Phase 1 (Restyle)  -->  Phase 2 (Missing Pages)
                                                           |
                                                     Phase 3 (Backend Fixes)
                                                           |
                                                     Phase 4 (v3 Pages)
```

Phase 0 and Phase 3 can run in parallel (different concerns). Phases 1, 2, 4 are sequential frontend work.

---

## 5. File Change Summary

### New files to create
```
packages/frontend/src/components/ui/Button.tsx
packages/frontend/src/components/ui/Badge.tsx
packages/frontend/src/components/ui/Card.tsx
packages/frontend/src/components/ui/Input.tsx
packages/frontend/src/components/ui/Select.tsx
packages/frontend/src/components/ui/Table.tsx
packages/frontend/src/components/ui/Spinner.tsx
packages/frontend/src/components/ui/Skeleton.tsx
packages/frontend/src/components/ui/PageHeader.tsx
packages/frontend/src/pages/projects/Metrics.tsx
packages/frontend/src/pages/projects/Traceability.tsx
packages/frontend/src/pages/projects/Retros.tsx
packages/frontend/src/pages/projects/Tests.tsx
packages/frontend/src/pages/projects/TestPlans.tsx
packages/frontend/src/pages/projects/Incidents.tsx
```

### Files to modify
```
packages/frontend/src/index.css                              — verify design tokens match spec
packages/frontend/src/App.tsx                                — add new routes
packages/frontend/src/components/layout/Shell.tsx             — full redesign
packages/frontend/src/locales/en/common.json                  — add missing keys
packages/frontend/src/pages/Dashboard.tsx                     — add metric cards
packages/frontend/src/pages/projects/Detail.tsx               — add metric strip + nav
packages/frontend/src/pages/projects/Kanban.tsx               — redesign to spec
packages/frontend/src/pages/projects/Workflow.tsx             — add status mapping UI
packages/frontend/src/pages/projects/Gates.tsx                — redesign to spec
packages/frontend/src/pages/projects/Settings.tsx             — add test connection + health badges
packages/backend/prisma/schema.prisma                         — add missing fields (Phase 3)
packages/backend/src/ingestion/webhooks/webhooks.controller.ts — implement processing
packages/backend/src/knowledge/incidents/incidents.service.ts  — fix MTTR
```

---

### Phase 5 — Agent-based Workflow Automation (v4)

**Goal**: Implement the orchestration engine that maps SDLC phases to agent profiles and executes tasks with parallel scheduling.

> **Prerequisite**: Phases 0–3 complete. Message broker (NATS/Kafka) available from v2 infrastructure.

**P5-1: Database schema — Agent Orchestration tables**
- `agent_profiles` (id, name, role, description, skill_set, supported_phases, is_default, project_id, created_at, updated_at)
- `phase_agent_mappings` (id, project_id, phase_id, agent_profile_id, priority, created_at)
- `workflow_executions` (id, project_id, status, started_at, completed_at, initiated_by, config)
- `workflow_tasks` (id, workflow_execution_id, phase_id, agent_profile_id, status, started_at, completed_at, error, retry_count)
- `agent_instances` (id, workflow_task_id, agent_profile_id, session_id, status, started_at, last_heartbeat, completed_at)
- `task_dependencies` (id, task_id, depends_on_task_id)
- `artifact_outputs` (id, workflow_task_id, agent_instance_id, artifact_type, name, content_ref, ai_dlc_artifact_id, created_at)

**P5-2: Orchestration Engine service**
- `OrchestrationModule` in Knowledge Service (or new Automation Service group)
- DAG builder: generate dependency graph from phase order + explicit dependencies
- Scheduler: evaluate eligible tasks, enforce concurrency limit, start agent instances
- Completion handler: process callbacks, re-evaluate DAG, trigger downstream tasks
- Lifecycle manager: heartbeat monitoring, timeout detection, retry logic

**P5-3: Agent Profile Registry API**
- CRUD endpoints: `POST/GET/PUT/DELETE /api/projects/:id/agent-profiles`
- Default profiles seeding on project creation
- Validation: at least one supported phase, non-empty skill set

**P5-4: Phase-to-Agent Mapping API**
- CRUD endpoints: `POST/GET/PUT/DELETE /api/projects/:id/phase-agent-mappings`
- Validation: agent profile supports target phase
- Priority ordering

**P5-5: Workflow Execution API**
- `POST /api/projects/:id/workflow-executions` — start execution
- `PATCH /api/projects/:id/workflow-executions/:execId` — pause/resume/cancel
- `GET /api/projects/:id/workflow-executions/:execId` — status + task list + DAG
- `GET /api/projects/:id/workflow-executions/:execId/tasks` — task details
- Completion callback endpoint: `POST /api/agent-callback` (agent → engine)

**P5-6: AI-DLC Integration**
- Create `ai_dlc_sessions` record on agent instance start
- Create `ai_dlc_artifacts` record on artifact output
- Wire `ai_approvals` for human-in-the-loop approval gates
- Wire `ai_clarifications` for agent-to-human questions

**P5-7: Frontend — Agent Configuration UI**
- Agent Profiles page (`/projects/:id/agents`) — table + create/edit form
- Phase-to-Agent Mapping UI on Workflow page — drag-and-drop or select per phase

**P5-8: Frontend — Workflow Execution UI**
- Start Workflow button on project detail
- Execution monitoring dashboard: DAG visualization, task states, progress bar
- Real-time updates (polling or WebSocket)
- Pause/Resume/Cancel controls
- Artifact output viewer per task

**Deliverable**: Full agent-based workflow automation operational for a project.

---

## 6. Updated Execution Order

```
Phase 0 (Design System)  -->  Phase 1 (Restyle)  -->  Phase 2 (Missing Pages)
                                                           |
                                                     Phase 3 (Backend Fixes)
                                                           |
                                                     Phase 4 (v3 Pages)
                                                           |
                                                     Phase 5 (Agent Automation - v4)
```

Phase 5 requires v2 message broker infrastructure and completed v1–v3 backend.
