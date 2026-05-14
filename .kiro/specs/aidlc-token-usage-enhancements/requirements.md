# Requirements Document

## Introduction

This feature set enhances the SDLC Hub's AI-DLC workspace with token usage tracking, cost optimization suggestions, workflow flexibility improvements, and a dedicated epics management page. The goal is to give teams full visibility into LLM consumption, reduce costs through data-driven recommendations, and streamline the epic run workflow with file-based inputs and the ability to reopen approved steps.

## Glossary

- **Token_Usage_Service**: The backend service responsible for recording, aggregating, and querying LLM token consumption data across all agent executions.
- **Token_Usage_Log**: A database record capturing a single LLM call's input tokens, output tokens, model identifier, provider, estimated cost, and association to an epic run step.
- **Token_Usage_Report_Panel**: A frontend panel accessible from the status bar that displays aggregated token usage statistics for today and the current month.
- **Cost_Suggestion_Engine**: The backend service that analyzes historical token usage patterns and generates actionable cost-reduction recommendations.
- **Epics_List_Page**: A standalone frontend page at `/projects/:id/workspace/epics` that displays all epic runs with filtering, sorting, and quick actions.
- **File_Upload_Handler**: The component responsible for accepting, validating, and extracting text content from uploaded `.md` and `.txt` files.
- **Request_Update_Action**: The workflow action that reopens an already-approved epic run step, resetting it to "running" state while preserving the approval history.
- **Agent_Executor_Service**: The existing backend service that orchestrates LLM calls for agent work within epic run steps.
- **LLM_Router_Service**: The existing service that routes LLM calls to the appropriate provider and returns responses including token usage data.
- **Epic_Run_Step**: A single step within an epic run, associated with an agent profile, following the state machine: pending → running → completed → approved/rejected.

## Requirements

### Requirement 1: Token Usage Logging

**User Story:** As a project manager, I want every LLM call to be logged with token counts and cost estimates, so that I can track AI spending per epic and per step.

#### Acceptance Criteria

1. WHEN the Agent_Executor_Service receives an LLM response, THE Token_Usage_Service SHALL create a Token_Usage_Log record containing the input token count, output token count, model identifier, provider name, estimated cost, epic run ID, and epic run step ID.
2. THE Token_Usage_Log SHALL store the estimated cost calculated as (input tokens × input price per token) + (output tokens × output price per token) based on the model's pricing configuration.
3. IF the LLM_Router_Service returns a response without usage data, THEN THE Token_Usage_Service SHALL record the call with zero token counts and zero cost estimate.
4. THE Token_Usage_Service SHALL support querying aggregated token usage grouped by epic run ID, epic run step ID, model, provider, and time range.
5. WHEN a Token_Usage_Log record is created, THE Token_Usage_Service SHALL associate it with the current project ID for multi-project isolation.

### Requirement 2: Token Usage UI Badges

**User Story:** As a developer, I want to see token usage badges on epic runs and steps in the UI, so that I can quickly identify which parts of the workflow consume the most tokens.

#### Acceptance Criteria

1. WHEN an epic run is displayed in the UI, THE Epics_List_Page SHALL show a badge indicating the total token count (input + output) for that epic run.
2. WHEN an epic run step is displayed in the approval gate UI, THE Token_Usage_Report_Panel SHALL show a badge indicating the token count consumed by that specific step.
3. THE token usage badges SHALL format large numbers using abbreviated notation (e.g., "12.3k" for 12,300 tokens, "1.2M" for 1,200,000 tokens).
4. WHEN token usage data is not yet available for a step, THE badge SHALL display a dash character ("—") instead of a number.

### Requirement 3: Token Usage Report Panel

**User Story:** As a team lead, I want a Token Usage Report panel accessible from the status bar, so that I can monitor today's and this month's LLM spending at a glance.

#### Acceptance Criteria

1. THE status bar SHALL display a token usage indicator showing today's total estimated cost formatted as a currency value.
2. WHEN the user clicks the status bar token usage indicator, THE Token_Usage_Report_Panel SHALL open displaying today's total tokens, today's estimated cost, this month's total tokens, and this month's estimated cost.
3. THE Token_Usage_Report_Panel SHALL display a breakdown of token usage by model, showing each model's percentage of total consumption.
4. THE Token_Usage_Report_Panel SHALL display a breakdown of token usage by agent, showing each agent's percentage of total consumption.
5. WHEN the Token_Usage_Report_Panel is open, THE panel SHALL refresh its data every 30 seconds without requiring manual interaction.
6. THE Token_Usage_Report_Panel SHALL display a daily usage trend chart for the current month showing cost per day.

### Requirement 4: Request Update on Approved Steps

**User Story:** As a developer, I want to reopen an already-approved epic run step when requirements change, so that the step can be re-executed with updated context without losing the approval history.

#### Acceptance Criteria

1. WHEN a user triggers the Request_Update_Action on an approved Epic_Run_Step, THE Epic_Runs_Service SHALL reset the step status from "approved" to "running" and set a new startedAt timestamp.
2. WHEN the Request_Update_Action is performed, THE Epic_Runs_Service SHALL create an EpicRunHistory record with action "update_requested" containing the original approval timestamp and the reason for the update.
3. WHEN the Request_Update_Action resets a step, THE Epic_Runs_Service SHALL reset all downstream steps (steps with higher stepOrder) to "pending" status.
4. WHEN the Request_Update_Action is performed on a step that is not the current step, THE Epic_Runs_Service SHALL update the epic run's currentStep to the reopened step's stepOrder.
5. IF the epic run status is "completed", THEN THE Epic_Runs_Service SHALL transition the epic run status back to "running" when a Request_Update_Action is performed.
6. THE Request_Update_Action SHALL accept an optional context string that is stored on the step and passed to the agent during re-execution.

### Requirement 5: Load from File for Epic Descriptions

**User Story:** As a developer, I want to upload a .md or .txt file as the epic description or as feedback when rejecting/rerunning a step, so that I can provide detailed context without manually copying text into a textarea.

#### Acceptance Criteria

1. WHEN the user initiates an epic run creation, THE File_Upload_Handler SHALL accept a single .md or .txt file as the epic description input.
2. WHEN the user provides rejection feedback, THE File_Upload_Handler SHALL accept a single .md or .txt file as the feedback content.
3. WHEN the user provides rerun context, THE File_Upload_Handler SHALL accept a single .md or .txt file as the context content.
4. THE File_Upload_Handler SHALL validate that uploaded files have a .md or .txt extension and reject files with other extensions by displaying an error message.
5. THE File_Upload_Handler SHALL validate that uploaded files do not exceed 500 KB in size and reject larger files by displaying an error message indicating the size limit.
6. WHEN a valid file is uploaded, THE File_Upload_Handler SHALL extract the text content and populate the corresponding textarea, allowing the user to review and edit before submission.
7. THE File_Upload_Handler SHALL support drag-and-drop file upload in addition to the file picker button.

### Requirement 6: Cost Suggestions Based on API Usage Data

**User Story:** As a team lead, I want the system to analyze token usage patterns and suggest cost-reduction strategies, so that I can optimize LLM spending without manual analysis.

#### Acceptance Criteria

1. WHEN a user requests cost suggestions, THE Cost_Suggestion_Engine SHALL analyze the last 30 days of Token_Usage_Log records for the project.
2. WHEN an agent's average token usage per call exceeds 3 times the project-wide average, THE Cost_Suggestion_Engine SHALL generate a suggestion indicating that the agent uses significantly more tokens than average.
3. WHEN an agent performs tasks that consistently use fewer than 1,000 output tokens, THE Cost_Suggestion_Engine SHALL generate a suggestion recommending a smaller, cheaper model for that agent.
4. WHEN the same input prompt (determined by content hash) appears more than 5 times within 7 days, THE Cost_Suggestion_Engine SHALL generate a suggestion recommending caching for repeated inputs.
5. THE Cost_Suggestion_Engine SHALL return suggestions as a list, each containing a suggestion type, a human-readable message, the affected agent or skill name, and the estimated monthly savings.
6. IF fewer than 10 Token_Usage_Log records exist for the project, THEN THE Cost_Suggestion_Engine SHALL return an empty suggestion list with a message indicating insufficient data.

### Requirement 7: Dedicated Epics List Page

**User Story:** As a developer, I want a dedicated page listing all epic runs with status, progress, and quick actions, so that I can manage epics without navigating through multiple views.

#### Acceptance Criteria

1. THE Epics_List_Page SHALL be accessible at the route `/projects/:id/workspace/epics` and display all epic runs for the project.
2. THE Epics_List_Page SHALL display each epic run with its status badge, progress indicator (completed steps / total steps), pipeline name, work item title, token usage summary, and creation date.
3. THE Epics_List_Page SHALL provide quick action buttons for each epic run: "Approve" (for the current completed step), "Reject" (for the current completed step), and "Start" (for pending runs).
4. THE Epics_List_Page SHALL support filtering epic runs by status (pending, running, paused, completed, failed, cancelled).
5. THE Epics_List_Page SHALL support sorting epic runs by creation date (ascending/descending) and by total token usage (ascending/descending).
6. WHEN no epic runs exist for the project, THE Epics_List_Page SHALL display an empty state with a message and a button to create a new epic run.
7. THE Epics_List_Page SHALL update the displayed data in real-time when epic run statuses change, using polling with a 10-second interval.
8. THE Epics_List_Page SHALL be linked from the workspace sidebar navigation.
