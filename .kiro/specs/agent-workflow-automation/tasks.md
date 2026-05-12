# Implementation Plan: Agent-based Workflow Automation

## Overview

This plan implements the Agent-based Workflow Automation feature for SDLC Hub v4. The implementation is organized by layer: database schema first, then backend services (Agent Registry, Orchestration Engine, Agent Runtime), followed by API controllers, and finally frontend pages. Each task builds incrementally on previous work, with checkpoints to validate progress.

The system uses TypeScript throughout: NestJS backend with Prisma ORM, React 19 frontend, and fast-check for property-based testing.

## Tasks

- [ ] 1. Database schema and migrations
  - [ ] 1.1 Create Prisma schema additions for agent orchestration tables
    - Add `AgentProfile` model with fields: id, projectId, name, role (enum), description, skillSet, supportedPhases, isDefault, timestamps
    - Add `PhaseAgentMapping` model with fields: id, projectId, phaseId, agentProfileId, priority, createdAt
    - Add `WorkflowExecution` model with fields: id, projectId, status (enum), config (Json), startedAt, completedAt, initiatedBy, timestamps
    - Add `WorkflowTask` model with fields: id, workflowExecutionId, phaseId, agentProfileId, status (enum), startedAt, completedAt, error, retryCount, timestamps
    - Add `TaskDependency` model with fields: id, taskId, dependsOnTaskId
    - Add `AgentInstance` model with fields: id, workflowTaskId, agentProfileId, sessionId, status (enum), startedAt, lastHeartbeat, completedAt, durationMs, error, timestamps
    - Add `ArtifactOutput` model with fields: id, workflowTaskId, agentInstanceId, artifactType (enum), name, contentRef, aiDlcArtifactId, metadata, createdAt
    - Add enums: AgentRole, WorkflowExecutionStatus, TaskStatus, AgentInstanceStatus, ArtifactType
    - Add all indexes and unique constraints as specified in design
    - Add relations to existing models (Project, User, AiDlcSession, AiDlcArtifact)
    - _Requirements: 1.1, 3.4, 5.1, 7.1, 7.4_

  - [ ] 1.2 Generate and run Prisma migration
    - Run `npx prisma migrate dev` to generate the migration SQL
    - Verify migration applies cleanly against the development database
    - Verify foreign key relationships to existing tables (projects, users, ai_dlc_sessions, ai_dlc_artifacts)
    - _Requirements: 1.1, 7.4, 10.1, 10.2_

- [ ] 2. Backend — Agent Registry module
  - [ ] 2.1 Create Agent Profile Service
    - Create `packages/backend/src/knowledge/agent-registry/` module directory
    - Implement `AgentProfileService` with CRUD operations: create, findAll, findById, update, delete
    - Implement `seedDefaults(projectId)` to create default profiles (BA_Agent, Dev_Agent, QA_Agent, DevOps_Agent)
    - Implement validation: reject create/update if skillSet is empty or supportedPhases is empty
    - Implement guard: reject update if profile is referenced by a running WorkflowExecution
    - Implement guard: reject delete if profile is referenced by any PhaseAgentMapping
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 2.2 Write property tests for Agent Profile Service
    - **Property 1: Agent profile round-trip persistence**
    - **Property 2: Agent profile validation rejects invalid inputs**
    - **Validates: Requirements 1.1, 1.2**

  - [ ] 2.3 Create Phase-Agent Mapping Service
    - Implement `PhaseAgentMappingService` with CRUD operations: create, findByProject, findByPhase, update, delete
    - Implement validation: reject mapping if agent profile's supportedPhases does not include the target phaseId
    - Implement `validateMappings(projectId)` that checks all phases have mappings and all mappings reference valid profiles
    - Return mappings sorted by priority (ascending) when querying by phase
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 2.4 Write property tests for Phase-Agent Mapping Service
    - **Property 3: Phase-agent mapping validation enforces phase support**
    - **Property 4: Phase-agent mappings are returned in priority order**
    - **Validates: Requirements 2.1, 2.2, 2.3**

  - [ ]* 2.5 Write unit tests for Agent Registry module
    - Test create profile with valid data
    - Test create profile with empty skillSet (rejected)
    - Test update profile during active execution (rejected with 409)
    - Test delete profile with active mappings (rejected)
    - Test seed defaults creates 4 profiles
    - Test mapping creation with unsupported phase (rejected)
    - Test validateMappings returns issues for unmapped phases
    - _Requirements: 1.1–1.5, 2.1–2.5_

- [ ] 3. Checkpoint — Agent Registry complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Backend — Orchestration Engine core
  - [ ] 4.1 Implement DAG Builder
    - Create `packages/backend/src/knowledge/orchestration/dag-builder.service.ts`
    - Implement `buildDAG(phases, mappings)` that creates TaskNode for each phase-agent mapping
    - Implement dependency edge generation: tasks in phase N depend on all tasks in phase N-1
    - Implement `getEligibleTasks()`: return pending tasks where all dependencies are in "done" status
    - Implement `getCriticalPath()`: compute longest path through the DAG
    - Implement `getProgress()`: return completed/total/percentage
    - Skip phases with no mappings (log warning)
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.5, 8.4, 8.5_

  - [ ]* 4.2 Write property tests for DAG Builder
    - **Property 5: Task decomposition produces correct tasks with correct assignments**
    - **Property 6: DAG structure has correct dependency edges**
    - **Property 7: DAG eligible task evaluation**
    - **Property 19: Progress percentage calculation**
    - **Property 20: Critical path is the longest path in the DAG**
    - **Validates: Requirements 3.1, 3.2, 3.3, 4.1, 4.4, 4.5, 8.4, 8.5**

  - [ ] 4.3 Implement Scheduler
    - Create `packages/backend/src/knowledge/orchestration/scheduler.service.ts`
    - Implement `evaluate(execution)`: load DAG, find eligible tasks, respect concurrency limit
    - Implement `getAvailableSlots(execution)`: calculate maxConcurrency minus currently running count
    - Enforce that paused executions return zero tasks to start
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 9.2_

  - [ ]* 4.4 Write property tests for Scheduler
    - **Property 8: Concurrency limit enforcement**
    - **Property 21: Paused execution prevents new task starts**
    - **Validates: Requirements 4.3, 9.2**

  - [ ] 4.5 Implement Lifecycle Manager
    - Create `packages/backend/src/knowledge/orchestration/lifecycle-manager.service.ts`
    - Implement `startAgent(task, profile)`: create AgentInstance, transition pending → starting → running
    - Implement `recordHeartbeat(instanceId)`: update lastHeartbeat timestamp
    - Implement `checkHealth()`: find stale instances (lastHeartbeat < now - 2*interval), mark as failed
    - Implement `terminateAgent(instanceId, reason)`: send termination signal, force-terminate after grace period
    - Implement `retryTask(task)`: increment retryCount, create new instance if retries remaining, else mark permanently failed
    - Enforce valid state transitions only (pending→starting→running→done/failed/timed_out)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 4.6 Write property tests for Lifecycle Manager
    - **Property 9: Agent instance state machine allows only valid transitions**
    - **Property 10: Retry count never exceeds configured maximum**
    - **Property 11: Heartbeat timeout detection**
    - **Validates: Requirements 5.1, 5.3, 5.5**

  - [ ] 4.7 Implement Callback Handler
    - Create `packages/backend/src/knowledge/orchestration/callback-handler.service.ts`
    - Implement `processCallback(callback)`: validate payload, update task status
    - On status "done": store artifact outputs, mark task done, re-evaluate DAG
    - On status "failed": store error, notify project owner, trigger retry logic
    - Create ArtifactOutput records and link to ai_dlc_artifacts table
    - Wrap status update + artifact creation + DAG re-evaluation in a database transaction
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.4_

  - [ ]* 4.8 Write property tests for Callback Handler
    - **Property 12: Completion callback processing updates state and stores artifacts**
    - **Property 14: Artifact output round-trip persistence**
    - **Property 15: Artifact type validation**
    - **Validates: Requirements 6.2, 7.1, 7.2**

  - [ ] 4.9 Implement Orchestration Engine service
    - Create `packages/backend/src/knowledge/orchestration/orchestration-engine.service.ts`
    - Implement `startExecution(projectId, config)`: validate mappings, decompose tasks, build DAG, persist, start eligible tasks
    - Implement `pauseExecution(executionId)`: set status to paused, let running tasks finish
    - Implement `resumeExecution(executionId)`: set status to running, re-evaluate DAG
    - Implement `cancelExecution(executionId)`: send termination to running instances, mark pending tasks as cancelled
    - Implement `getExecution(executionId)`: return execution detail with tasks, progress, DAG
    - Implement `handleCallback(callback)`: delegate to CallbackHandler, check workflow completion
    - Mark execution as "blocked" if no agent profile can be resolved for a required task
    - Mark execution as "completed" when all tasks reach terminal state
    - Send summary notification on completion
    - _Requirements: 3.1, 3.4, 3.5, 4.4, 6.5, 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 4.10 Write property tests for Orchestration Engine
    - **Property 13: Workflow completion detection**
    - **Property 22: Cancellation marks all pending tasks as cancelled**
    - **Validates: Requirements 6.5, 9.4**

- [ ] 5. Checkpoint — Orchestration Engine core complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Backend — Agent Runtime
  - [ ] 6.1 Implement Agent Executor (in-process)
    - Create `packages/backend/src/knowledge/agent-runtime/agent-executor.service.ts`
    - Implement `start(instance, context)`: spawn async task, transition states, begin heartbeat reporting, execute work, send completion callback
    - Implement `sendTermination(instanceId)`: signal graceful shutdown via shouldTerminate flag
    - Implement `forceTerminate(instanceId)`: forcefully stop the agent after grace period
    - Build AgentContext with task info, profile, input artifacts (from upstream completed tasks), sessionId, callbackUrl
    - _Requirements: 5.2, 7.3, 9.4, 9.5_

  - [ ]* 6.2 Write property test for artifact availability
    - **Property 16: Upstream artifacts are available to downstream tasks**
    - **Validates: Requirements 7.3**

  - [ ] 6.3 Implement AI-DLC integration
    - On agent instance start: create record in `ai_dlc_sessions` table linking to workflow execution and task
    - On artifact output: create record in `ai_dlc_artifacts` table with session reference
    - Wire `ai_approvals` for human-in-the-loop approval gates
    - Wire `ai_clarifications` for agent-to-human questions
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ]* 6.4 Write unit tests for Agent Runtime
    - Test agent start creates ai_dlc_session
    - Test artifact output creates ai_dlc_artifact
    - Test termination signal sets shouldTerminate
    - Test force terminate after grace period
    - Test input artifacts from upstream tasks are passed correctly
    - _Requirements: 7.3, 10.1, 10.2_

- [ ] 7. Checkpoint — Backend services complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Backend — API controllers and DTOs
  - [ ] 8.1 Create Agent Profiles controller
    - Create `packages/backend/src/knowledge/agent-registry/agent-profiles.controller.ts`
    - Implement endpoints: POST, GET (list), GET (by id), PUT, DELETE at `/api/projects/:projectId/agent-profiles`
    - Create DTOs: CreateAgentProfileDto, UpdateAgentProfileDto with class-validator decorators
    - Validation: name (1-100 chars, required), role (enum, required), skillSet (min 1 item), supportedPhases (min 1 valid phase ID)
    - Add RBAC guard: only Project Owners can manage profiles
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

  - [ ] 8.2 Create Phase-Agent Mappings controller
    - Create `packages/backend/src/knowledge/agent-registry/phase-agent-mappings.controller.ts`
    - Implement endpoints: POST, GET (list with optional phaseId filter), PUT, DELETE at `/api/projects/:projectId/phase-agent-mappings`
    - Implement POST `/api/projects/:projectId/phase-agent-mappings/validate` endpoint
    - Create DTOs: CreateMappingDto, UpdateMappingDto with validation
    - Add RBAC guard: only Project Owners can manage mappings
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 8.3 Create Workflow Executions controller
    - Create `packages/backend/src/knowledge/orchestration/workflow-executions.controller.ts`
    - Implement POST `/api/projects/:projectId/workflow-executions` (start execution)
    - Implement GET `/api/projects/:projectId/workflow-executions` (list executions)
    - Implement GET `/api/projects/:projectId/workflow-executions/:execId` (execution detail with progress)
    - Implement PATCH `/api/projects/:projectId/workflow-executions/:execId` (pause/resume/cancel)
    - Implement GET `/api/projects/:projectId/workflow-executions/:execId/tasks` (task list)
    - Implement GET `/api/projects/:projectId/workflow-executions/:execId/dag` (DAG structure)
    - Implement GET `/api/projects/:projectId/workflow-executions/:execId/artifacts` (all artifacts)
    - Create DTOs: StartExecutionDto (with WorkflowConfig), PatchExecutionDto (action: pause/resume/cancel)
    - Add RBAC guard: only Project Owners can manage executions
    - _Requirements: 8.1, 8.4, 9.1, 9.2, 9.3, 9.4_

  - [ ] 8.4 Create Agent Callback controller
    - Create `packages/backend/src/knowledge/orchestration/agent-callback.controller.ts`
    - Implement POST `/api/agent-callback` (completion callback from agents)
    - Implement POST `/api/agent-heartbeat` (heartbeat from agents)
    - Create DTOs: CompletionCallbackDto, HeartbeatDto with validation
    - Heartbeat response includes `shouldTerminate` flag
    - _Requirements: 6.1, 6.3, 6.6, 5.4_

  - [ ]* 8.5 Write unit tests for API controllers
    - Test validation rejection for invalid DTOs
    - Test RBAC enforcement (non-owners get 403)
    - Test conflict responses (409 for active profile update)
    - Test pause/resume/cancel state transitions via PATCH
    - Test callback processing returns correct responses
    - _Requirements: 1.2, 1.3, 9.1–9.5_

- [ ] 9. Backend — Artifact and monitoring endpoints
  - [ ] 9.1 Implement artifact consolidated view
    - Add logic to group artifacts by SDLC phase in the executions artifacts endpoint
    - Ensure all artifacts from a completed execution are included, grouped by producing task's phase
    - _Requirements: 7.5_

  - [ ]* 9.2 Write property test for artifact grouping
    - **Property 17: Artifact consolidated view groups correctly by phase**
    - **Validates: Requirements 7.5**

  - [ ] 9.3 Implement at-risk task detection
    - Add configurable duration threshold to WorkflowConfig
    - In execution detail response, flag tasks where elapsed time exceeds threshold as "at_risk"
    - _Requirements: 8.3_

  - [ ]* 9.4 Write property test for at-risk detection
    - **Property 18: At-risk task detection**
    - **Validates: Requirements 8.3**

  - [ ] 9.5 Implement AI-DLC API extension
    - Add query parameters to existing AI-DLC endpoints for filtering by workflowExecutionId
    - Ensure agent workflow data is accessible through existing AI-DLC session and artifact views
    - _Requirements: 10.5_

- [ ] 10. Checkpoint — Backend API complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Backend — NestJS module wiring
  - [ ] 11.1 Create and register NestJS modules
    - Create `AgentRegistryModule` exporting AgentProfileService and PhaseAgentMappingService
    - Create `OrchestrationModule` exporting OrchestrationEngine, DAGBuilder, Scheduler, LifecycleManager, CallbackHandler
    - Create `AgentRuntimeModule` exporting AgentExecutor
    - Register all modules in the Knowledge Service module
    - Wire dependencies between modules (OrchestrationModule imports AgentRegistryModule, AgentRuntimeModule)
    - Register heartbeat health check as a scheduled task (cron)
    - _Requirements: 3.1, 5.4_

- [ ] 12. Frontend — Agent Profiles page
  - [ ] 12.1 Create Agent Profiles list page
    - Create page at route `/projects/:id/agents`
    - Implement data table showing all profiles: name, role badge, skill set tags, supported phases, default indicator
    - Add "Create Profile" button in page header
    - Add edit and delete actions per row
    - Delete shows confirmation dialog; blocked if referenced by mappings (show error toast)
    - Add navigation link in project sidebar/nav
    - _Requirements: 1.1, 1.4, 1.5_

  - [ ] 12.2 Create Agent Profile form (create/edit)
    - Implement slide-over panel with form fields: name input, role dropdown, description textarea, skill set tag input, phase multi-select
    - Client-side validation: name required (1-100 chars), role required, at least 1 skill, at least 1 phase
    - Edit mode: pre-fill form; disable if profile is in active use (show info message)
    - On submit: call POST or PUT API endpoint, refresh list on success
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 12.3 Write unit tests for Agent Profiles page
    - Test table renders profiles correctly
    - Test form validation (empty fields rejected)
    - Test delete confirmation dialog
    - _Requirements: 1.1, 1.2_

- [ ] 13. Frontend — Phase-Agent Mapping UI
  - [ ] 13.1 Add Agent Mappings section to Workflow page
    - Add "Agent Mappings" section below existing phase configuration on `/projects/:id/workflow`
    - For each phase card, show assigned agent(s) with priority badges
    - Add "Assign Agent" button per phase that opens a dropdown filtered to compatible agents
    - Add remove (X) button on agent chips
    - Add priority reorder controls (up/down arrows)
    - Add "Validate Mappings" button that calls validation endpoint and shows results
    - Show validation status indicator (green check or yellow warning per phase)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 13.2 Write unit tests for Phase-Agent Mapping UI
    - Test agent assignment dropdown filters by supported phases
    - Test validation results display
    - Test priority reordering
    - _Requirements: 2.1, 2.2, 2.3_

- [ ] 14. Frontend — Workflow Execution Dashboard
  - [ ] 14.1 Create Workflow Executions list page
    - Create page at route `/projects/:id/workflow-executions`
    - Add "Start Workflow" button that opens config dialog (maxConcurrency, timeouts, retries)
    - Implement data table: status badge, progress bar, started at, duration, initiated by
    - Click row navigates to execution detail
    - _Requirements: 8.1, 9.1_

  - [ ] 14.2 Create Workflow Execution detail page
    - Create page at route `/projects/:id/workflow-executions/:execId`
    - Header: execution status badge, progress bar (percentage), elapsed time, initiated by user
    - Controls: Pause/Resume/Cancel buttons (contextual based on current status)
    - Side panel: task detail on node click (agent info, status, duration, artifacts list, error message)
    - Bottom section: artifact list grouped by phase with download/view links
    - Implement polling (every 5 seconds) while execution status is "running"
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 9.2, 9.3, 9.4, 7.5_

  - [ ] 14.3 Implement DAG visualization component
    - Use React Flow (or similar) for DAG rendering
    - Nodes represent tasks, colored by status: pending (gray), running (blue), done (green), failed (red), cancelled (muted gray)
    - Edges represent dependency arrows between tasks
    - Highlight critical path with thicker/brighter edges
    - "At risk" tasks get pulsing amber border
    - Node content: phase name, agent name, elapsed time
    - Click node: opens task detail side panel
    - Zoom/pan controls and status legend
    - _Requirements: 8.2, 8.3, 8.5_

  - [ ]* 14.4 Write unit tests for Workflow Execution Dashboard
    - Test status badge rendering for all states
    - Test pause/resume/cancel button visibility based on status
    - Test DAG node coloring by status
    - Test polling starts/stops based on execution status
    - _Requirements: 8.1, 8.2, 9.2, 9.3, 9.4_

- [ ] 15. Checkpoint — Frontend complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Integration wiring and end-to-end validation
  - [ ] 16.1 Wire notification dispatching
    - On task failure (retries exhausted): send in-app + Slack/Teams notification to Project Owner
    - On workflow blocked: send in-app + Slack/Teams notification to Project Owner
    - On workflow completed: send in-app notification with summary (done/failed breakdown)
    - On agent needs clarification: send in-app notification to assigned team member
    - _Requirements: 6.4, 6.5_

  - [ ]* 16.2 Write integration tests for end-to-end workflow
    - Test full workflow: start execution → tasks decomposed → agents run (mocked) → callbacks received → workflow completes
    - Test AI-DLC integration: agent start creates ai_dlc_session, artifact creates ai_dlc_artifact
    - Test concurrent callbacks handled correctly
    - Test notification dispatch on failure
    - Test cascade delete behavior (execution deleted → tasks → instances → artifacts cleaned up)
    - _Requirements: 6.5, 10.1, 10.2, 10.3, 10.4_

- [ ] 17. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at each layer boundary
- Property tests validate universal correctness properties from the design document (22 properties total)
- Unit tests validate specific examples and edge cases
- The backend uses NestJS modules, Prisma ORM, and class-validator for DTOs
- The frontend uses React 19, React Flow for DAG visualization, and the existing design system components
- Agent execution is in-process for v4 initial release (scalability path to worker pool is a future enhancement)
- Tasks 2.x and 4.x can be developed in parallel by different developers once schema (task 1) is complete
- Frontend tasks (12–14) can begin once API controllers (task 8) are complete
