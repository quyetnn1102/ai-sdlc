# Implementation Plan: AIDLC Workspace Builder

## Overview

This plan implements the AIDLC Workspace Builder feature in layers: database schema first, then backend services, API controllers, WebSocket gateways, and finally frontend components. Each task builds incrementally on the previous, ensuring no orphaned code. Property-based tests and unit tests are included as optional sub-tasks close to their related implementation.

## Tasks

- [x] 1. Database schema and migrations
  - [x] 1.1 Add new Prisma models for Workspace entities
    - Add `Skill`, `AgentSkill`, `Pipeline`, `PipelineStep`, `EpicRun`, `EpicRunStep`, `EpicRunHistory`, `WorkspaceConfig`, `WorkspaceTemplate`, `WalkthroughState` models to `packages/backend/prisma/schema.prisma`
    - Add `EpicRunStatus` and `EpicRunStepStatus` enums
    - Add relation fields to existing models: `Project` (skills, pipelines, epicRuns, workspaceConfig), `Organization` (workspaceTemplates), `AgentProfile` (agentSkills, pipelineSteps, epicRunSteps), `WorkItem` (epicRuns)
    - Add all indexes and unique constraints as specified in the design
    - _Requirements: 1.1, 2.1, 3.1, 5.7, 6.5, 7.5, 8.1, 8.7, 10.1, 11.5_

  - [x] 1.2 Generate and apply Prisma migration
    - Run `npx prisma migrate dev --name add_workspace_builder` to generate the migration SQL
    - Verify migration applies cleanly against the development database
    - Run `npx prisma generate` to update the Prisma client
    - _Requirements: 1.1, 2.1_

- [x] 2. Backend Workspace Module — Skill Service
  - [x] 2.1 Create Workspace module structure and Skill service
    - Create `packages/backend/src/workspace/workspace.module.ts` with module registration
    - Create `packages/backend/src/workspace/skills/skills.service.ts` with CRUD operations: create, findAll, findById, update, delete
    - Create `packages/backend/src/workspace/skills/dto/` with CreateSkillDto, UpdateSkillDto
    - Implement skill markdown validation (YAML frontmatter parsing, required fields check: name, description, prompt template)
    - Implement skill template listing (hello-world, code-reviewer, test-converter, doc-writer, release-notes)
    - Register WorkspaceModule in AppModule
    - _Requirements: 1.4, 1.5, 1.6, 5.1–5.8_

  - [ ]* 2.2 Write property tests for skill persistence and validation (Properties 1, 2)
    - **Property 1: Skill persistence round-trip** — For any valid skill markdown, create via API and read back produces identical document
    - **Property 2: Skill validation rejects invalid input** — For any skill missing required fields or with conflicting name, validation rejects with specific error
    - Create `packages/backend/src/workspace/__tests__/properties/skill-validation.property.spec.ts`
    - Use fast-check arbitraries to generate valid/invalid skill markdown
    - **Validates: Requirements 1.5, 1.6, 5.4, 5.7, 5.8**

  - [ ]* 2.3 Write unit tests for Skill service
    - Create `packages/backend/src/workspace/__tests__/unit/skill.service.spec.ts`
    - Test template content correctness, file upload size validation (1MB limit), name conflict detection
    - **Validates: Requirements 5.2, 5.3, 5.5, 5.8**

- [x] 3. Backend Workspace Module — Pipeline Service
  - [x] 3.1 Implement Pipeline service
    - Create `packages/backend/src/workspace/pipelines/pipelines.service.ts` with CRUD operations
    - Create `packages/backend/src/workspace/pipelines/dto/` with CreatePipelineDto, UpdatePipelineDto, ReorderStepsDto
    - Implement pipeline step management: add step, remove step, reorder steps
    - Implement validation: minimum 2 steps, unique name per project, valid on-failure values
    - _Requirements: 7.1–7.7_

  - [ ]* 3.2 Write property tests for pipeline step reordering (Property 14)
    - **Property 14: Pipeline step reordering** — For any pipeline with N steps and valid permutation, reorder updates step_order correctly
    - Create `packages/backend/src/workspace/__tests__/properties/display-order.property.spec.ts`
    - **Validates: Requirements 7.4**

  - [ ]* 3.3 Write property tests for entity validation (Property 11)
    - **Property 11: Agent and pipeline validation** — Zero skills or no model rejects agent; <2 steps or non-unique name rejects pipeline
    - Add to `packages/backend/src/workspace/__tests__/properties/display-order.property.spec.ts`
    - **Validates: Requirements 6.5, 7.5**

  - [ ]* 3.4 Write unit tests for Pipeline service
    - Create `packages/backend/src/workspace/__tests__/unit/pipeline.service.spec.ts`
    - Test on-failure toggle default value, step ordering, name conflict detection
    - **Validates: Requirements 7.3, 7.5, 7.6**

- [x] 4. Backend Workspace Module — EpicRun Service
  - [x] 4.1 Implement EpicRun service with state machine
    - Create `packages/backend/src/workspace/epic-runs/epic-runs.service.ts`
    - Create `packages/backend/src/workspace/epic-runs/dto/` with CreateEpicRunDto, ApproveStepDto, RejectStepDto, RerunStepDto
    - Implement epic run creation: bind pipeline to work item, create step instances from pipeline steps
    - Implement approval flow: approve step → advance to next step
    - Implement rejection flow: reject step with feedback → cascade reset downstream steps to "pending"
    - Implement rerun flow: re-execute step with rejection feedback + optional new context
    - Implement on-failure behavior: stop run or mark failed and continue
    - Implement execution history recording for all actions with timestamps
    - Enforce state machine transitions server-side (invalid transitions return 400)
    - _Requirements: 2.1–2.8_

  - [ ]* 4.2 Write property tests for epic run state machine (Properties 4, 5, 6, 7, 8)
    - **Property 4: Approval advances execution** — Approving step K transitions current step to K+1
    - **Property 5: Rejection cascades downstream reset** — Rejecting step K resets steps K+1..N to pending
    - **Property 6: Rerun context composition** — Rerun includes rejection feedback F and optional context C
    - **Property 7: On-failure behavior** — stop config fails run; continue config advances to next step
    - **Property 8: History completeness** — Every action produces a history entry with monotonic timestamps
    - Create `packages/backend/src/workspace/__tests__/properties/epic-run-state-machine.property.spec.ts`
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8**

  - [ ]* 4.3 Write unit tests for EpicRun service
    - Create `packages/backend/src/workspace/__tests__/unit/epic-run.service.spec.ts`
    - Test invalid state transitions, edge cases (approve pending step, reject already-approved step)
    - **Validates: Requirements 2.2, 2.4, 2.7**

- [x] 5. Checkpoint — Core services complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Backend Workspace Module — WorkspaceConfig and Inspector Services
  - [x] 6.1 Implement WorkspaceConfig service
    - Create `packages/backend/src/workspace/config/workspace-config.service.ts`
    - Implement get/update workspace config, slash command management
    - Implement YAML generation from database state (agents, skills, pipelines, slash commands)
    - Implement workspace status endpoint (counts of agents, skills, pipelines, active runs by status)
    - _Requirements: 3.1, 3.2, 3.4, 6.7, 7.7_

  - [x] 6.2 Implement Inspector service
    - Create `packages/backend/src/workspace/inspector/inspector.service.ts`
    - Implement YAML parsing and schema validation
    - Implement environment variable resolution (`${VAR_NAME}` substitution)
    - Implement error reporting with line numbers for syntax errors
    - Implement unresolved variable warning collection
    - Implement validation summary (entity counts, warnings, errors)
    - _Requirements: 10.1–10.6_

  - [ ]* 6.3 Write property tests for YAML generation (Property 13)
    - **Property 13: YAML generation completeness** — Generated YAML contains all agents, skills, pipelines, slash commands with correct counts
    - Create `packages/backend/src/workspace/__tests__/properties/yaml-generation.property.spec.ts`
    - **Validates: Requirements 6.7, 7.7, 10.6**

  - [ ]* 6.4 Write property tests for workspace inspector (Properties 18, 19, 20, 21)
    - **Property 18: YAML parsing and validation** — Valid YAML parses successfully with correct entity counts
    - **Property 19: Environment variable resolution** — M of N variables resolved, N-M left unresolved
    - **Property 20: Parse error reporting** — Syntax error at line L reported at line L (±1)
    - **Property 21: Unresolved variable warnings** — K undefined variables produce K warnings
    - Create `packages/backend/src/workspace/__tests__/properties/yaml-inspector.property.spec.ts`
    - **Validates: Requirements 10.1, 10.2, 10.4, 10.5**

  - [ ]* 6.5 Write property tests for workspace status (Property 9)
    - **Property 9: Workspace status counts match reality** — Status endpoint returns correct counts matching actual database state
    - Create `packages/backend/src/workspace/__tests__/properties/workspace-status.property.spec.ts`
    - **Validates: Requirements 3.1, 3.2, 3.4**

  - [ ]* 6.6 Write unit tests for WorkspaceConfig and Inspector services
    - Create `packages/backend/src/workspace/__tests__/unit/workspace-config.service.spec.ts`
    - Create `packages/backend/src/workspace/__tests__/unit/inspector.service.spec.ts`
    - Test YAML schema edge cases, missing workspace.yaml handling, slash command listing
    - **Validates: Requirements 3.4, 3.6, 10.4, 10.5**

- [x] 7. Backend Workspace Module — Template and Demo Services
  - [x] 7.1 Implement Template service
    - Create `packages/backend/src/workspace/templates/templates.service.ts`
    - Create `packages/backend/src/workspace/templates/dto/` with CreateTemplateDto, ApplyTemplateDto
    - Implement save workspace as template (snapshot agents, skills, pipelines, slash commands)
    - Implement apply template to project with conflict resolution (skip, rename, overwrite)
    - Implement built-in templates: "code-review", "release-notes", "sdlc"
    - Implement template deletion (organization-level, no cascade to applied projects)
    - _Requirements: 8.1–8.7_

  - [x] 7.2 Implement Demo service
    - Create `packages/backend/src/workspace/demo/demo.service.ts`
    - Implement demo project loading: create full SDLC pipeline with BA, Dev, QA, DevOps agents
    - Create 6 sample epic work items with varied complexity
    - Generate valid workspace.yaml with all entities and slash commands
    - Implement conflict detection (existing workspace) with merge/replace options
    - Implement demo status check endpoint
    - _Requirements: 4.1–4.6_

  - [ ]* 7.3 Write property tests for template round-trip and conflict resolution (Properties 15, 16, 17)
    - **Property 15: Template save/apply round-trip** — Save workspace as template, apply to empty project produces same entities
    - **Property 16: Template conflict resolution** — Skip leaves existing, overwrite replaces, rename creates suffixed entities
    - **Property 17: Template deletion isolation** — Deleting template does not affect projects that applied it
    - Create `packages/backend/src/workspace/__tests__/properties/template-roundtrip.property.spec.ts`
    - **Validates: Requirements 8.1, 8.3, 8.4, 8.6**

  - [ ]* 7.4 Write unit tests for Template and Demo services
    - Create `packages/backend/src/workspace/__tests__/unit/template.service.spec.ts`
    - Create `packages/backend/src/workspace/__tests__/unit/demo.service.spec.ts`
    - Test built-in template existence, demo entity creation counts, conflict detection
    - **Validates: Requirements 4.1, 4.2, 4.3, 8.5**

- [x] 8. Backend API Controllers
  - [x] 8.1 Implement Skills controller
    - Create `packages/backend/src/workspace/skills/skills.controller.ts`
    - Implement REST endpoints: GET /, GET /:id, POST /, PUT /:id, DELETE /:id, POST /validate, GET /templates
    - Add request validation with class-validator decorators on DTOs
    - Wire to SkillService
    - _Requirements: 1.4, 1.5, 5.1–5.8_

  - [x] 8.2 Implement Pipelines controller
    - Create `packages/backend/src/workspace/pipelines/pipelines.controller.ts`
    - Implement REST endpoints: GET /, GET /:id, POST /, PUT /:id, PUT /:id/steps, DELETE /:id
    - Wire to PipelineService
    - _Requirements: 7.1–7.7_

  - [x] 8.3 Implement EpicRuns controller
    - Create `packages/backend/src/workspace/epic-runs/epic-runs.controller.ts`
    - Implement REST endpoints: GET /, GET /:id, POST /, POST /:id/steps/:stepId/approve, POST /:id/steps/:stepId/reject, POST /:id/steps/:stepId/rerun, GET /:id/history
    - Wire to EpicRunService
    - _Requirements: 2.1–2.8_

  - [x] 8.4 Implement WorkspaceConfig controller
    - Create `packages/backend/src/workspace/config/workspace-config.controller.ts`
    - Implement REST endpoints: GET /config, PUT /config, GET /yaml, POST /inspect, GET /status
    - Wire to WorkspaceConfigService and InspectorService
    - _Requirements: 3.1–3.6, 10.1–10.6_

  - [x] 8.5 Implement Templates controller
    - Create `packages/backend/src/workspace/templates/templates.controller.ts`
    - Implement REST endpoints: GET /, GET /:id, POST /, POST /:id/apply, DELETE /:id
    - Scope to organization level (`/api/organizations/:orgId/workspace-templates`)
    - Wire to TemplateService
    - _Requirements: 8.1–8.7_

  - [x] 8.6 Implement Demo controller
    - Create `packages/backend/src/workspace/demo/demo.controller.ts`
    - Implement REST endpoints: POST /load, GET /status
    - Wire to DemoService
    - _Requirements: 4.1–4.6_

  - [ ]* 8.7 Write property tests for slug generation and conflict resolution (Properties 10, 12)
    - **Property 10: Agent ID slug generation** — Any display name produces valid kebab-case slug
    - **Property 12: Conflicting ID alternative suggestion** — Conflicting ID returns non-conflicting valid kebab-case alternative
    - Create `packages/backend/src/workspace/__tests__/properties/slug-generation.property.spec.ts`
    - **Validates: Requirements 6.4, 6.6**

  - [ ]* 8.8 Write property tests for display order persistence (Property 3)
    - **Property 3: Display order persistence** — Any permutation of cards persisted and queried returns correct order
    - Add to `packages/backend/src/workspace/__tests__/properties/display-order.property.spec.ts`
    - **Validates: Requirements 1.2**

- [x] 9. Checkpoint — Backend API complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Backend WebSocket Gateways
  - [x] 10.1 Implement Terminal module with PTY service and WebSocket gateway
    - Create `packages/backend/src/terminal/terminal.module.ts`
    - Create `packages/backend/src/terminal/pty.service.ts` — spawn Claude CLI processes, manage sessions per user
    - Create `packages/backend/src/terminal/terminal.gateway.ts` — WebSocket gateway handling events: terminal:open, terminal:input, terminal:output, terminal:resize, terminal:close, terminal:error
    - Implement session lifecycle: open spawns PTY, input pipes to PTY stdin, output streams PTY stdout, close kills process
    - Support multiple concurrent sessions per user
    - Register TerminalModule in AppModule
    - _Requirements: 9.1–9.7_

  - [x] 10.2 Implement Realtime module with WebSocket gateway
    - Create `packages/backend/src/realtime/realtime.module.ts`
    - Create `packages/backend/src/realtime/realtime.gateway.ts` — WebSocket gateway handling events: workspace:subscribe, workspace:status, epicrun:progress
    - Implement project-scoped rooms for workspace updates
    - Emit workspace:status on entity changes (skill/pipeline/agent CRUD)
    - Emit epicrun:progress on epic run step transitions
    - Register RealtimeModule in AppModule
    - Wire EpicRunService and WorkspaceConfigService to emit events via RealtimeGateway
    - _Requirements: 3.2, 3.3, 2.2_

  - [ ]* 10.3 Write integration tests for terminal and realtime gateways
    - Create `packages/backend/src/workspace/__tests__/integration/terminal.integration.spec.ts`
    - Create `packages/backend/src/workspace/__tests__/integration/realtime.integration.spec.ts`
    - Test WebSocket connection, session lifecycle, real-time event emission
    - **Validates: Requirements 3.3, 9.1–9.7**

- [x] 11. Checkpoint — Full backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Frontend — Shared components and hooks
  - [x] 12.1 Create workspace API client hooks
    - Create `packages/frontend/src/features/workspace/api/` with React Query hooks for all workspace endpoints
    - Implement hooks: useSkills, useSkill, useCreateSkill, useUpdateSkill, useDeleteSkill, useValidateSkill, useSkillTemplates
    - Implement hooks: usePipelines, usePipeline, useCreatePipeline, useUpdatePipeline, useReorderSteps, useDeletePipeline
    - Implement hooks: useEpicRuns, useEpicRun, useCreateEpicRun, useApproveStep, useRejectStep, useRerunStep, useEpicRunHistory
    - Implement hooks: useWorkspaceConfig, useUpdateWorkspaceConfig, useWorkspaceYaml, useInspectWorkspace, useWorkspaceStatus
    - Implement hooks: useTemplates, useCreateTemplate, useApplyTemplate, useDeleteTemplate
    - Implement hooks: useLoadDemo, useDemoStatus
    - _Requirements: 1.1–11.7_

  - [x] 12.2 Create WebSocket connection hooks
    - Create `packages/frontend/src/features/workspace/hooks/useWorkspaceSocket.ts` — connect to realtime gateway, subscribe to project workspace updates
    - Create `packages/frontend/src/features/workspace/hooks/useTerminalSocket.ts` — connect to terminal gateway, manage terminal session I/O
    - Implement auto-reconnection with exponential backoff (1s, 2s, 4s, max 30s)
    - _Requirements: 3.3, 9.2, 9.4_

  - [x] 12.3 Create shared workspace components
    - Create `packages/frontend/src/features/workspace/components/WorkspaceCard.tsx` — draggable card with name, type badge, config summary
    - Create `packages/frontend/src/features/workspace/components/SkillEditor.tsx` — markdown editor with YAML frontmatter validation
    - Create `packages/frontend/src/features/workspace/components/PipelineStepBuilder.tsx` — drag-and-drop step ordering with on-failure toggle
    - Create `packages/frontend/src/features/workspace/components/ApprovalGateUI.tsx` — approve/reject/rerun controls
    - Create `packages/frontend/src/features/workspace/components/InspectorOutput.tsx` — syntax-highlighted YAML output panel
    - _Requirements: 1.7, 1.3, 1.4, 2.2, 2.3, 2.4, 10.3_

- [x] 13. Frontend — Workspace Builder page
  - [x] 13.1 Implement WorkspaceBuilder page
    - Create `packages/frontend/src/features/workspace/pages/WorkspaceBuilder.tsx`
    - Render agents, skills, and pipelines as categorized card grids using WorkspaceCard
    - Implement drag-and-drop reordering within categories with optimistic UI updates and rollback on failure
    - Implement on-failure toggle on pipeline step cards
    - Implement inline skill editing (click edit → open SkillEditor pre-populated with content)
    - Implement save with validation (reject invalid markdown with error message)
    - Add route at `/projects/:id/workspace`
    - _Requirements: 1.1–1.7_

  - [ ]* 13.2 Write unit tests for WorkspaceBuilder page
    - Test card rendering, drag-and-drop reorder calls, inline edit flow, validation error display
    - **Validates: Requirements 1.1, 1.2, 1.4, 1.6**

- [x] 14. Frontend — Epic Run detail page
  - [x] 14.1 Implement EpicRunDetail page
    - Create `packages/frontend/src/features/workspace/pages/EpicRunDetail.tsx`
    - Display pipeline steps with current status, output, and approval controls
    - Implement approval flow: approve button → advance to next step
    - Implement rejection flow: reject with feedback textarea → cascade reset display
    - Implement rerun flow: rerun button with optional new context input
    - Show execution history timeline
    - Subscribe to epicrun:progress WebSocket events for live updates
    - Add route at `/projects/:id/workspace/runs/:runId`
    - _Requirements: 2.1–2.8_

  - [ ]* 14.2 Write unit tests for EpicRunDetail page
    - Test approval/rejection/rerun UI flows, history display, live update handling
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5**

- [x] 15. Frontend — Sidebar Panel
  - [x] 15.1 Implement WorkspaceSidebar panel
    - Create `packages/frontend/src/features/workspace/components/WorkspaceSidebar.tsx`
    - Display live counts of agents, skills, pipelines
    - Display active epic run statuses (running, paused, failed)
    - List slash commands from workspace config with click-to-execute
    - Subscribe to workspace:status WebSocket events for real-time count updates
    - Show warning indicator if workspace.yaml is missing or unparseable
    - _Requirements: 3.1–3.6_

  - [ ]* 15.2 Write unit tests for WorkspaceSidebar
    - Test count display, slash command listing, warning indicator, real-time update handling
    - **Validates: Requirements 3.1, 3.4, 3.6**

- [x] 16. Frontend — Wizard dialogs
  - [x] 16.1 Implement AddSkillWizard dialog
    - Create `packages/frontend/src/features/workspace/components/wizards/AddSkillWizard.tsx`
    - Present 4 source options: template, paste markdown, upload .md file, blank editor
    - Implement template selection with pre-populated content
    - Implement paste markdown with validation on submit
    - Implement file upload (.md, max 1MB) with content parsing
    - Implement blank editor with required field placeholders
    - Validate required fields (name, description, prompt template) and name uniqueness on submit
    - _Requirements: 5.1–5.8_

  - [x] 16.2 Implement AddAgentWizard dialog
    - Create `packages/frontend/src/features/workspace/components/wizards/AddAgentWizard.tsx`
    - Form with: display name, auto-generated kebab-case agent ID (editable), multi-select skill picker, model picker (Sonnet 4.6, Opus 4.7, Haiku 4.5)
    - Validate at least one skill selected and model chosen
    - Handle ID conflict with suggested alternative display
    - On success: update workspace.yaml and refresh builder panel
    - _Requirements: 6.1–6.7_

  - [x] 16.3 Implement AddPipelineWizard dialog
    - Create `packages/frontend/src/features/workspace/components/wizards/AddPipelineWizard.tsx`
    - Step-builder interface: add agents as sequential steps from project agent list
    - Configurable on-failure toggle per step (default: "stop")
    - Drag-and-drop step reordering
    - Validate minimum 2 steps and unique pipeline name
    - On success: update workspace.yaml and refresh builder panel
    - _Requirements: 7.1–7.7_

  - [x] 16.4 Implement SaveTemplateDialog and ApplyTemplateDialog
    - Create `packages/frontend/src/features/workspace/components/wizards/SaveTemplateDialog.tsx` — name input, optional description, save action
    - Create `packages/frontend/src/features/workspace/components/wizards/ApplyTemplateDialog.tsx` — template picker, conflict resolution UI (skip/rename/overwrite per entity)
    - _Requirements: 8.1–8.7_

  - [x] 16.5 Implement LoadDemoDialog
    - Create `packages/frontend/src/features/workspace/components/wizards/LoadDemoDialog.tsx`
    - Confirmation dialog with merge/replace options if workspace exists
    - On success: navigate to Workspace Builder with loaded config
    - _Requirements: 4.1–4.6_

  - [ ]* 16.6 Write unit tests for wizard dialogs
    - Test form validation, source option switching, file upload handling, conflict resolution UI
    - **Validates: Requirements 5.1, 5.8, 6.4, 6.6, 7.5, 7.6, 8.4**

- [x] 17. Frontend — Claude Console
  - [x] 17.1 Implement ClaudeConsole panel
    - Create `packages/frontend/src/features/workspace/components/ClaudeConsole.tsx`
    - Integrate xterm.js terminal emulator in the browser
    - Connect to backend terminal WebSocket gateway on open
    - Support standard terminal interactions: text input, command history (up/down), ANSI color rendering
    - Stream input to backend, stream output back in real time
    - Show connection error with retry action if backend unavailable
    - Support multiple concurrent sessions as tabs in bottom panel
    - Terminate session and release resources on close
    - _Requirements: 9.1–9.7_

  - [ ]* 17.2 Write unit tests for ClaudeConsole
    - Test terminal rendering, connection state handling, multi-tab management, error display
    - **Validates: Requirements 9.2, 9.5, 9.7**

- [x] 18. Frontend — Workspace Inspector
  - [x] 18.1 Implement Workspace Inspector UI
    - Create `packages/frontend/src/features/workspace/components/WorkspaceInspector.tsx`
    - Trigger button that calls POST /inspect endpoint
    - Display fully resolved YAML in InspectorOutput with syntax highlighting
    - Display parse errors with line numbers
    - Highlight unresolved environment variable references as warnings
    - Display validation summary (entity counts, warnings, errors)
    - _Requirements: 10.1–10.6_

  - [ ]* 18.2 Write unit tests for Workspace Inspector UI
    - Test success display, error display with line numbers, warning highlighting
    - **Validates: Requirements 10.3, 10.4, 10.5**

- [x] 19. Frontend — Interactive Walkthrough
  - [x] 19.1 Implement WalkthroughOverlay component
    - Create `packages/frontend/src/features/workspace/components/WalkthroughOverlay.tsx`
    - Implement 6-step guided tour: (1) Workspace Builder overview, (2) Adding a skill, (3) Adding an agent, (4) Creating a pipeline, (5) Running an epic, (6) Using the sidebar panel
    - Highlight relevant UI element per step with explanatory tooltip and "Next" action
    - Navigate to appropriate page if next step is on a different view
    - Implement "Skip" / close to dismiss and record walkthrough seen (prevent auto re-display)
    - Show resume/restart prompt on Welcome page if walkthrough incomplete
    - Show completion message with links to key actions on final step
    - Persist walkthrough state via backend API (WalkthroughState model)
    - _Requirements: 11.1–11.7_

  - [ ]* 19.2 Write unit tests for WalkthroughOverlay
    - Test step progression, skip/dismiss behavior, completion message, resume prompt
    - **Validates: Requirements 11.2, 11.4, 11.5, 11.7**

- [x] 20. Frontend — Route wiring and navigation
  - [x] 20.1 Wire all new routes and navigation entries
    - Add `/projects/:id/workspace` route pointing to WorkspaceBuilder page
    - Add `/projects/:id/workspace/runs/:runId` route pointing to EpicRunDetail page
    - Add workspace navigation entry to project sidebar
    - Integrate WorkspaceSidebar into project layout (persistent left panel)
    - Integrate ClaudeConsole into bottom panel toggle
    - Add "Get started with AIDLC" action on Welcome page to launch walkthrough
    - _Requirements: 1.1, 2.1, 3.1, 9.1, 11.1_

- [x] 21. Final checkpoint — Full feature complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties from the design document (21 properties total)
- Unit tests validate specific examples and edge cases
- The implementation follows a bottom-up approach: schema → services → controllers → gateways → frontend
- All backend code uses TypeScript with NestJS patterns; all frontend code uses React 19 with Tailwind CSS
- fast-check is used for all property-based tests; Jest is used for unit and integration tests
