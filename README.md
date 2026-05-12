# SDLC Hub

> A unified visibility and governance platform for the full Software Development Life Cycle — from requirements through code, test, deployment, and production operations.

SDLC Hub integrates with your existing tools (Jira, GitHub, CI/CD, SonarQube, PagerDuty) to surface actionable insights, enforce quality standards, and close the feedback loop between delivery and operations. The v4 feature adds **AI agent-based workflow automation** — each SDLC phase is assigned a specialized AI agent (BA, Dev, QA, DevOps) that executes tasks in parallel where possible and reports completion with artifacts.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Running the Project](#running-the-project)
- [Default Credentials](#default-credentials)
- [API Documentation](#api-documentation)
- [Agent Workflow Automation (v4)](#agent-workflow-automation-v4)
- [Running Tests](#running-tests)
- [Architecture Overview](#architecture-overview)
- [Contributing](#contributing)

---

## Features

| Feature | Status |
|---|---|
| JWT authentication + user registration | ✅ v1 |
| Organizations & projects management | ✅ v1 |
| SDLC workflow phases + Kanban board | ✅ v1 |
| Jira, GitHub, SonarQube integrations | ✅ v1 |
| Quality gates (advisory) | ✅ v1 |
| DORA metrics + flow metrics | ✅ v1 |
| Requirement → deployment traceability | ✅ v1 |
| Retrospective knowledge hub | ✅ v2 |
| Test management (cases, plans, runs) | ✅ v3 |
| Incident tracking + MTTR / CFR | ✅ v3 |
| GitLab, Jenkins, SAST integrations | ✅ v2 |
| PagerDuty integration | ✅ v3 |
| **AI agent-based workflow automation** | ✅ v4 |
| LLM integration (Claude, ChatGPT, Azure) | ✅ v4 |
| DAG-based parallel task execution | ✅ v4 |
| Real-time workflow execution dashboard | ✅ v4 |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js 22 + NestJS 10 (modular monolith) |
| **Frontend** | React 19 SPA + Vite + Tailwind CSS v4 |
| **Database** | PostgreSQL 16 + Prisma ORM |
| **Auth** | JWT (Passport.js) |
| **LLM** | Anthropic Claude / OpenAI / Azure OpenAI |
| **Package manager** | pnpm (workspaces monorepo) |
| **Testing** | Jest + ts-jest + fast-check (property-based) |

---

## Project Structure

```
ai-sdlc/
├── packages/
│   ├── backend/                  # NestJS API server
│   │   ├── prisma/
│   │   │   └── schema.prisma     # Database schema (v1–v4)
│   │   └── src/
│   │       ├── platform/         # Auth, Users, Organizations, Projects
│   │       ├── ingestion/        # Jira, GitHub, GitLab, CI/CD adapters + webhooks
│   │       ├── analytics/        # DORA metrics, quality gates, workflow phases
│   │       ├── knowledge/        # Traceability, retrospectives, test mgmt, incidents
│   │       ├── automation/       # v4: Agent profiles, orchestration engine, LLM runtime
│   │       └── common/           # Prisma, audit logging, health check, enums
│   └── frontend/                 # React 19 SPA
│       └── src/
│           ├── components/       # Shared UI components + layout
│           ├── pages/            # Route-level page components
│           ├── services/         # API client layer (one file per backend module)
│           ├── contexts/         # React context (Auth)
│           └── lib/              # API wrapper, hooks, utilities
├── docs/                         # Architecture, requirements, design system docs
├── .kiro/specs/                  # Feature specs (requirements, design, tasks)
├── docker-compose.yml            # PostgreSQL + Redis for local dev
├── package.json                  # Root workspace scripts
└── pnpm-workspace.yaml
```

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | ≥ 20 | Use [nvm](https://github.com/nvm-sh/nvm) — `.nvmrc` is included |
| pnpm | ≥ 9 | `npm install -g pnpm` |
| PostgreSQL | ≥ 14 | Local install or Docker |

> **Docker alternative**: If you have Docker, run `docker compose up -d` to start PostgreSQL and Redis automatically instead of installing them locally.

---

## Getting Started

### 1. Clone and install dependencies

```bash
git clone https://github.com/quyetnn1102/ai-sdlc.git
cd ai-sdlc
pnpm install
```

### 2. Set up environment variables

```bash
cp packages/backend/.env.example packages/backend/.env
```

Edit `packages/backend/.env` — at minimum set `DATABASE_URL` to point to your PostgreSQL instance.

### 3. Set up the database

```bash
# Create the schema and run all migrations
pnpm db:migrate

# Generate the Prisma client
pnpm db:generate

# Seed with a default admin user, organization, project, and workflow phases
pnpm db:seed
```

### 4. Start the development servers

Open two terminals:

```bash
# Terminal 1 — Backend API (http://localhost:3000)
pnpm dev:backend

# Terminal 2 — Frontend (http://localhost:5173)
pnpm dev:frontend
```

---

## Environment Variables

All variables live in `packages/backend/.env`. Copy from `.env.example` to get started.

### Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. Format: `postgresql://user:pass@host:5432/db?schema=sdlc_v4` |
| `JWT_SECRET` | Secret key for signing JWT tokens. Use a long random string in production. |

### Optional — Notifications

| Variable | Description |
|---|---|
| `SLACK_WEBHOOK_URL` | Slack incoming webhook URL for agent failure/completion alerts |
| `TEAMS_WEBHOOK_URL` | Microsoft Teams incoming webhook URL |

### Optional — LLM Providers (Agent Automation v4)

Set at least one to enable real AI-powered agents. If none are set, agents run in **simulation mode** (returns placeholder Markdown — useful for testing the workflow without API costs).

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `ANTHROPIC_MODEL` | Model to use (default: `claude-sonnet-4-5`) |
| `OPENAI_API_KEY` | OpenAI API key for ChatGPT |
| `OPENAI_MODEL` | Model to use (default: `gpt-4o`) |
| `AZURE_OPENAI_KEY` | Azure OpenAI key (GitHub Copilot uses Azure) |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint URL |
| `AZURE_OPENAI_DEPLOYMENT` | Azure deployment name (default: `gpt-4o`) |
| `DEFAULT_LLM_PROVIDER` | Which provider to use by default: `claude` \| `openai` \| `azure` \| `simulate` |

---

## Database Setup

The project uses a dedicated PostgreSQL schema (`sdlc_v4`) to avoid conflicts with other databases on the same server.

```bash
# If using an existing PostgreSQL instance, create the user and database first:
psql -U postgres -c "CREATE USER sdlc WITH PASSWORD 'sdlc_password' CREATEDB;"
psql -U postgres -c "CREATE DATABASE sdlc_hub;"
psql -U postgres -d sdlc_hub -c "CREATE SCHEMA IF NOT EXISTS sdlc_v4; GRANT ALL ON SCHEMA sdlc_v4 TO sdlc;"

# Then run migrations:
pnpm db:migrate
pnpm db:seed
```

The seed creates:
- Admin user: `admin@sdlchub.dev` / `admin123!`
- Default Organization: `Default Organization`
- Demo Project with 7 SDLC workflow phases

---

## Running the Project

### Development

```bash
pnpm dev:backend    # NestJS with hot reload → http://localhost:3000
pnpm dev:frontend   # Vite dev server → http://localhost:5173
```

The frontend proxies all `/api` requests to the backend automatically (configured in `vite.config.ts`).

### Production build

```bash
pnpm build:backend   # Compiles to packages/backend/dist/
pnpm build:frontend  # Compiles to packages/frontend/dist/
```

### Useful database commands

```bash
pnpm db:migrate    # Run pending migrations
pnpm db:generate   # Regenerate Prisma client after schema changes
pnpm db:seed       # Re-seed the database
```

---

## Default Credentials

After running `pnpm db:seed`:

| Field | Value |
|---|---|
| Email | `admin@sdlchub.dev` |
| Password | `admin123!` |

> Change these immediately in any non-local environment.

---

## API Documentation

The backend exposes a Swagger UI at:

```
http://localhost:3000/api/docs
```

All endpoints are grouped by tag (Organizations, Projects, Workflow Executions, Agent Profiles, etc.) and require a Bearer JWT token except for `/api/auth/login` and `/api/auth/register`.

---

## Agent Workflow Automation (v4)

This is the flagship v4 feature. It lets you automate SDLC tasks by assigning AI agents to workflow phases.

### How it works

1. **Create agent profiles** — Go to a project → **Agents** → "Seed defaults" to create BA, Dev, QA, and DevOps agents. Each profile has a role, skill set, and supported phases.

2. **Map agents to phases** — On the **Workflow** page, each phase card has an "Agent Assignments" section. Click "+ Assign agent" to map an agent to a phase.

3. **Start a workflow execution** — Go to **Executions** → "Start Workflow". The orchestration engine:
   - Decomposes the workflow into tasks (one per phase-agent mapping)
   - Builds a dependency graph (DAG) — tasks in phase N depend on phase N-1
   - Executes independent tasks in parallel (bounded by `maxConcurrency`)
   - Each agent calls the configured LLM, produces a Markdown artifact, and reports done

4. **Monitor progress** — The execution dashboard shows a real-time DAG visualization with color-coded task states, critical path highlighting, and artifact outputs grouped by phase.

### Agent roles and their prompts

| Role | Default phases | What it produces |
|---|---|---|
| BA Agent | Idea, Ready for Dev | Requirements document, user stories |
| Dev Agent | In Dev, In Review | Technical design, implementation notes |
| QA Agent | In Test | Test plan, test cases |
| DevOps Agent | Ready for Release, In Production | Deployment runbook, quality gate checklist |

### Enabling real LLM calls

By default agents run in simulation mode. To use a real LLM:

```bash
# In packages/backend/.env
ANTHROPIC_API_KEY=sk-ant-...
DEFAULT_LLM_PROVIDER=claude
```

Restart the backend — agents will now call Claude for each task.

### Per-agent LLM override

Each agent profile has a **LLM Configuration** section in the edit form where you can override the provider, model, and system prompt for that specific agent.

---

## Running Tests

```bash
# Backend unit + property-based tests
pnpm --filter @ai-sdlc/backend test

# Run a specific test file
pnpm --filter @ai-sdlc/backend test -- --testPathPattern="dag.builder.spec"

# With coverage
pnpm --filter @ai-sdlc/backend test:cov
```

The DAG builder has 23 property-based tests covering correctness properties 5–9, 13, 19–22 from the spec (using [fast-check](https://github.com/dubzzz/fast-check)).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    React 19 SPA (Vite)                   │
│  Dashboard · Kanban · Workflow · Agents · Executions     │
└──────────────────────┬──────────────────────────────────┘
                       │ REST /api/*
┌──────────────────────▼──────────────────────────────────┐
│              NestJS Modular Monolith                      │
│                                                           │
│  Platform    │ Auth, Users, Orgs, Projects               │
│  Ingestion   │ Jira, GitHub, GitLab, CI/CD, Webhooks     │
│  Analytics   │ DORA metrics, Quality gates               │
│  Knowledge   │ Traceability, Retros, Tests, Incidents    │
│  Automation  │ Agent profiles, Orchestration, LLM runtime│
└──────────────────────┬──────────────────────────────────┘
                       │ Prisma ORM
┌──────────────────────▼──────────────────────────────────┐
│           PostgreSQL (schema: sdlc_v4)                    │
│  30+ tables covering v1–v4 features                       │
└─────────────────────────────────────────────────────────┘
```

### Key design decisions

- **Modular monolith** — 5 service groups with clear boundaries. Split into microservices only when scaling profiles diverge.
- **Deterministic traceability** — every trace link uses an explicit mechanism (no heuristics). Auditable by design.
- **DAG-based orchestration** — parallel task execution with configurable concurrency limits, heartbeat monitoring, and retry logic.
- **LLM provider abstraction** — swap Claude/OpenAI/Azure per agent profile without touching business logic.
- **Simulation mode** — agents work without any API keys, returning placeholder output. Useful for testing the workflow end-to-end.

Full architecture details: [`docs/architecture.md`](docs/architecture.md)  
Product requirements: [`docs/requirements.md`](docs/requirements.md)  
Agent automation spec: [`.kiro/specs/agent-workflow-automation/`](.kiro/specs/agent-workflow-automation/)

---

## Contributing

1. Fork the repo and create a feature branch: `git checkout -b feat/your-feature`
2. Follow the existing code style (NestJS services + controllers, React functional components)
3. Add tests for new backend logic — property-based tests preferred for algorithmic code
4. Run `pnpm lint` and `pnpm format` before committing
5. Open a PR against `main` with a clear description of what changed and why

### Adding a new integration

1. Create an adapter in `packages/backend/src/ingestion/adapters/`
2. Add the integration type to the `Integration.type` field in `schema.prisma`
3. Wire the adapter into `WebhooksService` and `SchedulerService`
4. Add the integration card to the frontend Settings page

### Adding a new agent role

1. Add the role to `AgentRole` enum in `packages/backend/src/common/enums.ts`
2. Add a default profile entry in `AgentsService.DEFAULT_PROFILES`
3. Add a role-specific system prompt in `packages/backend/src/automation/agent-runtime/providers/prompt-builder.ts`
4. Add the role color to `roleColors` in `packages/frontend/src/pages/projects/Agents.tsx`
