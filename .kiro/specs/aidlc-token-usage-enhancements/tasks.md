# Implementation Plan: AIDLC Token Usage and Epic Enhancements

## Overview

This plan implements token usage tracking, cost optimization suggestions, workflow flexibility (request update, file upload), and a dedicated epics list page. The implementation follows a bottom-up approach: database schema → backend services → API controller → frontend components. Each task builds incrementally on the previous, ensuring no orphaned code. Property-based tests and unit tests are included as optional sub-tasks close to their related implementation.

## Tasks

- [x] 1. Database schema and migrations
  - [x] 1.1 Add TokenUsageLog Prisma model and update relations
    - Add `TokenUsageLog` model to `packages/backend/prisma/schema.prisma` with fields: id, projectId, epicRunId, epicRunStepId, agentProfileId, model, provider, inputTokens, outputTokens, estimatedCost, promptHash, metadata, createdAt
    - Add indexes on: [projectId, createdAt], [epicRunId], [epicRunStepId], [agentProfileId], [promptHash]
    - Add `tokenUsageLogs TokenUsageLog[]` relation to existing models: Project, EpicRun, EpicRunStep, AgentProfile
    - Map table to `token_usage_logs` with appropriate column mappings
    - _Requirements: 1.1, 1.5_

  - [x] 1.2 Generate and apply Prisma migration
    - Run `npx prisma migrate dev --name add_token_usage_log` to generate the migration SQL
    - Verify migration applies cleanly against the development database
    - Run `npx prisma generate` to update the Prisma client
    - _Requirements: 1.1_

- [x] 2. Backend — Model Pricing Configuration
  - [x] 2.1 Create model pricing config and cost calculation utility
    - Create `packages/backend/src/workspace/token-usage/model-pricing.config.ts`
    - Define `ModelPricing` interface with model, provider, inputPricePerToken, outputPricePerToken
    - Define `MODEL_PRICING` array with entries for claude-sonnet-4-5, claude-3-haiku, gpt-4o, gpt-4o-mini
    - Implement `calculateCost(model, inputTokens, outputTokens)` function that looks up pricing and computes `(inputTokens × inputPricePerToken) + (outputTokens × outputPricePerToken)`
    - Implement `getModelPricing(model)` function returning pricing or undefined for unknown models
    - Use fallback of $0 cost for unknown models and log a warning
    - _Requirements: 1.2_

  - [ ]* 2.2 Write property test for cost calculation (Property 1)
    - **Property 1: Cost calculation formula**
    - For any valid model pricing and any non-negative integer pair (inputTokens, outputTokens), `calculateCost` returns exactly `(inputTokens × inputPricePerToken) + (outputTokens × outputPricePerToken)`
    - Create `packages/backend/src/workspace/token-usage/model-pricing.spec.ts`
    - Use fast-check to generate arbitrary non-negative integers for token counts
    - **Validates: Requirements 1.2**

- [x] 3. Backend — TokenUsageService
  - [x] 3.1 Implement TokenUsageService
    - Create `packages/backend/src/workspace/token-usage/token-usage.service.ts`
    - Implement `log()` method: fire-and-forget, calculates cost using `calculateCost`, creates TokenUsageLog record. If LLM response has no usage data, record with zero tokens and zero cost. Errors are logged but not propagated.
    - Implement `getEpicRunUsage(epicRunId)`: aggregate totalInputTokens, totalOutputTokens, totalCost for an epic run
    - Implement `getStepUsage(epicRunStepId)`: aggregate token usage for a specific step
    - Implement `getTodaySummary(projectId)`: today's total tokens and estimated cost
    - Implement `getReport(projectId)`: full report with today, thisMonth, byModel breakdown, byAgent breakdown, dailyTrend
    - Implement `queryLogs(projectId, fromDate, toDate)`: query logs with date range filter for cost suggestion engine
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 3.2 Write property test for token usage log round-trip (Property 2)
    - **Property 2: Token usage log round-trip**
    - For any valid LLM response with token usage data, when `log()` is called and the record is queried back, persisted record contains exact same projectId, epicRunId, epicRunStepId, agentProfileId, model, provider, inputTokens, outputTokens, and estimatedCost
    - Create `packages/backend/src/workspace/token-usage/token-usage.service.spec.ts`
    - **Validates: Requirements 1.1, 1.5**

  - [ ]* 3.3 Write property test for aggregation correctness (Property 3)
    - **Property 3: Aggregation correctness**
    - For any set of TokenUsageLog records belonging to the same epicRunId, aggregated totals equal the sum of individual values
    - Add to `packages/backend/src/workspace/token-usage/token-usage.service.spec.ts`
    - **Validates: Requirements 1.4**

  - [ ]* 3.4 Write unit tests for TokenUsageService
    - Test edge cases: missing usage data records zero tokens (Req 1.3), aggregation returns zeroes for no records, getTodaySummary with no data returns zero
    - Add to `packages/backend/src/workspace/token-usage/token-usage.service.spec.ts`
    - **Validates: Requirements 1.3, 1.4**

- [x] 4. Backend — CostSuggestionService
  - [x] 4.1 Implement CostSuggestionService
    - Create `packages/backend/src/workspace/token-usage/cost-suggestion.service.ts`
    - Define `CostSuggestion` interface with type, message, affectedEntity, estimatedMonthlySavings
    - Implement `getSuggestions(projectId)`: analyze last 30 days of logs
    - If fewer than 10 records exist, return empty suggestions with "Insufficient data" message
    - Detect high-usage agents: average tokens per call > 3× project-wide average → generate "high_usage_agent" suggestion
    - Detect model downgrade candidates: agent's records ALL have outputTokens < 1000 → generate "model_downgrade" suggestion
    - Detect prompt caching opportunities: same promptHash appears > 5 times within 7 days → generate "prompt_caching" suggestion
    - Each suggestion includes type, human-readable message, affected entity name, and estimated monthly savings
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 4.2 Write property test for high-usage agent detection (Property 9)
    - **Property 9: High-usage agent detection**
    - For any set of logs where an agent's average total tokens per call exceeds 3× the project-wide average, a "high_usage_agent" suggestion is generated
    - Create `packages/backend/src/workspace/token-usage/cost-suggestion.service.spec.ts`
    - **Validates: Requirements 6.2**

  - [ ]* 4.3 Write property test for model downgrade suggestion (Property 10)
    - **Property 10: Model downgrade suggestion for low-output agents**
    - For any set of logs where an agent's records ALL have outputTokens < 1000, a "model_downgrade" suggestion is generated
    - Add to `packages/backend/src/workspace/token-usage/cost-suggestion.service.spec.ts`
    - **Validates: Requirements 6.3**

  - [ ]* 4.4 Write property test for prompt caching suggestion (Property 11)
    - **Property 11: Prompt caching suggestion for repeated hashes**
    - For any set of logs where a specific promptHash appears > 5 times within any 7-day window, a "prompt_caching" suggestion is generated
    - Add to `packages/backend/src/workspace/token-usage/cost-suggestion.service.spec.ts`
    - **Validates: Requirements 6.4**

  - [ ]* 4.5 Write property test for suggestion field completeness (Property 12)
    - **Property 12: All suggestions have required fields**
    - For any non-empty suggestion list, every suggestion has non-empty type, message, affectedEntity, and non-negative estimatedMonthlySavings
    - Add to `packages/backend/src/workspace/token-usage/cost-suggestion.service.spec.ts`
    - **Validates: Requirements 6.5**

  - [ ]* 4.6 Write unit tests for CostSuggestionService
    - Test insufficient data case (< 10 records returns empty with message), edge cases for threshold boundaries
    - Add to `packages/backend/src/workspace/token-usage/cost-suggestion.service.spec.ts`
    - **Validates: Requirements 6.6**

- [x] 5. Backend — EpicRunsService requestUpdate method
  - [x] 5.1 Add requestUpdate method to EpicRunsService
    - Update `packages/backend/src/workspace/epic-runs/epic-runs.service.ts`
    - Implement `requestUpdate(id, stepId, dto: { reason?, context? })`:
      - Validate step exists and has status "approved" (return 400 if not)
      - Reset step status from "approved" to "running", set new startedAt timestamp, clear approvedAt
      - Reset all downstream steps (stepOrder > current) to "pending" status
      - Update epic run's currentStep to the reopened step's stepOrder
      - If epic run status is "completed", transition back to "running"
      - Create EpicRunHistory record with action "update_requested" containing original approval timestamp and reason
      - Store optional context string on the step for re-execution
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 5.2 Write property test for request update state transitions (Property 6)
    - **Property 6: Request update resets step and downstream**
    - For any epic run with N steps where step K is "approved", calling requestUpdate on step K results in: step K = "running" with new startedAt, all steps > K = "pending", epic run currentStep = K
    - Create `packages/backend/src/workspace/epic-runs/epic-runs-request-update.spec.ts`
    - **Validates: Requirements 4.1, 4.3, 4.4, 4.6**

  - [ ]* 5.3 Write property test for request update history (Property 7)
    - **Property 7: Request update creates history with original approval**
    - For any approved step with an approvedAt timestamp, calling requestUpdate creates an EpicRunHistory record with action "update_requested" containing the original approvedAt and the provided reason
    - Add to `packages/backend/src/workspace/epic-runs/epic-runs-request-update.spec.ts`
    - **Validates: Requirements 4.2**

  - [ ]* 5.4 Write unit tests for requestUpdate
    - Test: calling on non-approved step returns 400, calling on non-existent step returns 404, completed epic run transitions back to "running"
    - Add to `packages/backend/src/workspace/epic-runs/epic-runs-request-update.spec.ts`
    - **Validates: Requirements 4.5**

- [x] 6. Checkpoint — Core backend services complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Backend — TokenUsageController and module wiring
  - [x] 7.1 Create TokenUsageController
    - Create `packages/backend/src/workspace/token-usage/token-usage.controller.ts`
    - Implement endpoints scoped to `projects/:projectId/workspace/token-usage`:
      - `GET /today` → calls `TokenUsageService.getTodaySummary(projectId)`
      - `GET /report` → calls `TokenUsageService.getReport(projectId)`
      - `GET /epic-run/:epicRunId` → calls `TokenUsageService.getEpicRunUsage(epicRunId)`
      - `GET /step/:stepId` → calls `TokenUsageService.getStepUsage(stepId)`
      - `GET /suggestions` → calls `CostSuggestionService.getSuggestions(projectId)`
    - Add proper error handling: 404 for non-existent project, zeroed response for no data
    - _Requirements: 1.4, 3.1, 3.2, 6.1_

  - [x] 7.2 Create TokenUsage module and wire into WorkspaceModule
    - Create `packages/backend/src/workspace/token-usage/token-usage.module.ts`
    - Register TokenUsageService, CostSuggestionService, TokenUsageController
    - Import into WorkspaceModule
    - _Requirements: 1.1_

  - [x] 7.3 Add requestUpdate endpoint to EpicRuns controller
    - Add `POST /:id/steps/:stepId/request-update` endpoint to existing `packages/backend/src/workspace/epic-runs/epic-runs.controller.ts`
    - Create RequestUpdateDto with optional reason and context fields
    - Wire to `EpicRunsService.requestUpdate()`
    - _Requirements: 4.1_

  - [x] 7.4 Integrate token logging into AgentExecutorService
    - Update `packages/backend/src/automation/agent-runtime/agent-executor.service.ts`
    - After receiving LLM response from LlmRouterService, call `TokenUsageService.log()` with projectId, epicRunId, epicRunStepId, agentProfileId, model, provider, inputTokens, outputTokens, and promptHash (SHA-256 of input)
    - Ensure the call is fire-and-forget (do not await, catch errors silently)
    - _Requirements: 1.1, 1.3_

  - [ ]* 7.5 Write unit tests for TokenUsageController
    - Test endpoint routing, parameter extraction, error responses
    - Create `packages/backend/src/workspace/token-usage/token-usage.controller.spec.ts`
    - **Validates: Requirements 1.4, 6.1**

- [x] 8. Checkpoint — Backend API complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Frontend — TokenUsageBadge component
  - [x] 9.1 Implement TokenUsageBadge component
    - Create `packages/frontend/src/features/workspace/components/TokenUsageBadge.tsx`
    - Props: `tokens: number | null`, `size?: 'sm' | 'md'`
    - Implement `formatTokenCount` utility: null → "—", N < 1000 → raw number, 1000 ≤ N < 1M → "X.Yk", N ≥ 1M → "X.YM"
    - Render as compact inline badge with Tailwind styling
    - _Requirements: 2.3, 2.4_

  - [ ]* 9.2 Write property test for token count formatting (Property 4)
    - **Property 4: Token count formatting**
    - For any non-negative integer N, the formatter produces: raw number for N < 1000, string ending in "k" for 1000 ≤ N < 1M, string ending in "M" for N ≥ 1M. For null, produces "—"
    - Create `packages/frontend/src/features/workspace/components/TokenUsageBadge.test.tsx`
    - Use fast-check to generate arbitrary non-negative integers
    - **Validates: Requirements 2.3, 2.4**

- [x] 10. Frontend — FileUploadHandler component
  - [x] 10.1 Implement FileUploadHandler component
    - Create `packages/frontend/src/features/workspace/components/FileUploadHandler.tsx`
    - Accept `.md` and `.txt` files only, max 500 KB
    - Support click-to-browse and drag-and-drop
    - On valid file: read content via FileReader API, call `onContent(text: string)` callback
    - On invalid extension: display inline error "Only .md and .txt files are supported."
    - On size exceeded: display inline error "File size exceeds the 500 KB limit."
    - On FileReader error: display inline error "Failed to read file. Please try again."
    - Does NOT upload to server — client-side only
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 10.2 Write property test for file validation (Property 8)
    - **Property 8: File validation accepts only .md/.txt under 500KB**
    - For any file with a given filename and size, the validator accepts if and only if extension is ".md" or ".txt" AND size ≤ 512,000 bytes
    - Create `packages/frontend/src/features/workspace/components/FileUploadHandler.test.tsx`
    - Use fast-check to generate arbitrary filenames and sizes
    - **Validates: Requirements 5.4, 5.5**

  - [ ]* 10.3 Write unit tests for FileUploadHandler
    - Test drag-and-drop interaction, successful file read populates textarea, error message display
    - Add to `packages/frontend/src/features/workspace/components/FileUploadHandler.test.tsx`
    - **Validates: Requirements 5.6, 5.7**

- [x] 11. Frontend — StatusBarTokenIndicator and TokenUsageReportPanel
  - [x] 11.1 Implement StatusBarTokenIndicator component
    - Create `packages/frontend/src/features/workspace/components/StatusBarTokenIndicator.tsx`
    - Fetch today's estimated cost via `GET /token-usage/today` endpoint
    - Display formatted currency value in the status bar area
    - Clicking opens the TokenUsageReportPanel
    - Show "—" if API returns error
    - _Requirements: 3.1_

  - [x] 11.2 Implement TokenUsageReportPanel component
    - Create `packages/frontend/src/features/workspace/components/TokenUsageReportPanel.tsx`
    - Slide-over panel triggered from StatusBarTokenIndicator
    - Sections: Today summary (total tokens + cost), Month summary (total tokens + cost), By Model breakdown (model name + percentage), By Agent breakdown (agent name + percentage), Daily trend chart (CSS-based bar chart)
    - Fetch data via `GET /token-usage/report` endpoint
    - Auto-refresh every 30 seconds using polling interval
    - Show skeleton placeholders while loading, error toast on failure
    - Show stale data indicator after 3 consecutive polling failures
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 11.3 Write property test for percentage breakdown (Property 5)
    - **Property 5: Percentage breakdown sums to 100%**
    - For any non-empty array of token usage values grouped by category, computed percentages sum to 100% (±0.1% tolerance), and each percentage equals `(categoryTokens / totalTokens) × 100`
    - Create `packages/frontend/src/features/workspace/components/TokenUsageReportPanel.test.tsx`
    - **Validates: Requirements 3.3, 3.4**

  - [ ]* 11.4 Write unit tests for StatusBarTokenIndicator and TokenUsageReportPanel
    - Test: indicator displays cost, click opens panel, panel sections render, polling refreshes data, error states
    - Add to `packages/frontend/src/features/workspace/components/TokenUsageReportPanel.test.tsx`
    - Create `packages/frontend/src/features/workspace/components/StatusBarTokenIndicator.test.tsx`
    - **Validates: Requirements 3.1, 3.5**

- [x] 12. Frontend — EpicsListPage
  - [x] 12.1 Implement EpicsListPage component
    - Create `packages/frontend/src/features/workspace/pages/EpicsListPage.tsx`
    - Route: `/projects/:id/workspace/epics`
    - Display all epic runs in a table/card layout with columns: status badge, progress (X/Y steps), pipeline name, work item title, TokenUsageBadge, creation date, quick actions
    - Implement quick action buttons: "Approve" (current completed step), "Reject" (current completed step), "Start" (pending runs)
    - Implement status filter dropdown (pending, running, paused, completed, failed, cancelled)
    - Implement sorting: creation date (asc/desc), token usage (asc/desc)
    - Display empty state with message and CTA button to create new epic run when no runs exist
    - Poll every 10 seconds for updates
    - Show stale data indicator after 3 consecutive polling failures
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 12.2 Add EpicsListPage route and sidebar navigation link
    - Register route `/projects/:id/workspace/epics` pointing to EpicsListPage
    - Add "Epics" link to workspace sidebar navigation
    - _Requirements: 7.1, 7.8_

  - [ ]* 12.3 Write property test for status filtering (Property 13)
    - **Property 13: Status filtering correctness**
    - For any list of epic runs with mixed statuses and any single status filter, the filtered result contains exactly those runs matching the filter
    - Create `packages/frontend/src/features/workspace/pages/EpicsListPage.test.tsx`
    - Use fast-check to generate arbitrary lists of epic runs with random statuses
    - **Validates: Requirements 7.4**

  - [ ]* 12.4 Write property test for sorting correctness (Property 14)
    - **Property 14: Sorting correctness**
    - For any list of epic runs, sorting by creation date (asc) produces monotonically non-decreasing dates, sorting by token usage (desc) produces monotonically non-increasing totals
    - Add to `packages/frontend/src/features/workspace/pages/EpicsListPage.test.tsx`
    - **Validates: Requirements 7.5**

  - [ ]* 12.5 Write unit tests for EpicsListPage
    - Test: empty state rendering, quick action buttons, polling behavior, filter/sort UI interactions
    - Add to `packages/frontend/src/features/workspace/pages/EpicsListPage.test.tsx`
    - **Validates: Requirements 7.3, 7.6, 7.7**

- [x] 13. Frontend — Integration of FileUploadHandler and Request Update
  - [x] 13.1 Integrate FileUploadHandler into epic creation and feedback flows
    - Add FileUploadHandler to epic run creation form (epic description input)
    - Add FileUploadHandler to rejection feedback dialog
    - Add FileUploadHandler to rerun context input
    - On valid file upload, populate corresponding textarea with extracted text content, allowing user to review and edit before submission
    - _Requirements: 5.1, 5.2, 5.3, 5.6_

  - [x] 13.2 Add Request Update UI to EpicRunDetail page
    - Add "Request Update" button on approved steps in the EpicRunDetail page
    - Show dialog with optional reason textarea and optional context textarea (with FileUploadHandler)
    - Call `POST /:id/steps/:stepId/request-update` endpoint on submit
    - Update UI to reflect step reset to "running" and downstream steps reset to "pending"
    - _Requirements: 4.1, 4.6_

- [x] 14. Frontend — Wire StatusBarTokenIndicator into layout
  - [x] 14.1 Add StatusBarTokenIndicator to workspace layout
    - Integrate StatusBarTokenIndicator into the workspace layout status bar area
    - Ensure it fetches data for the current project context
    - Wire TokenUsageReportPanel slide-over to open/close on indicator click
    - _Requirements: 3.1, 3.2_

  - [x] 14.2 Add TokenUsageBadge to epic run step approval gate UI
    - Display token usage badge on each step in the approval gate UI showing step-level token consumption
    - Fetch step usage via `GET /token-usage/step/:stepId`
    - Show "—" when data is not yet available
    - _Requirements: 2.1, 2.2, 2.4_

- [x] 15. Final checkpoint — Full feature complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties from the design document (14 properties total)
- Unit tests validate specific examples and edge cases
- The implementation follows a bottom-up approach: schema → services → controller → frontend components
- All backend code uses TypeScript with NestJS patterns; all frontend code uses React 19 with Tailwind CSS
- fast-check is used for all property-based tests; Jest is used for backend unit tests
- Token logging integration into AgentExecutorService is fire-and-forget to avoid impacting agent execution performance
