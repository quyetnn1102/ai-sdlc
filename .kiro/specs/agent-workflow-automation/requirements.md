# Requirements Document — Agent-based Workflow Automation

## Introduction

Agent-based Workflow Automation extends the SDLC Hub (v4) with an intelligent orchestration layer that automatically assigns and executes tasks by mapping each SDLC workflow phase to a specialized AI agent profile. When a workflow step begins, the system starts the corresponding agent (e.g., BA agent for requirements, Dev agent for implementation, QA agent for testing). Tasks without dependencies execute in parallel, and agents report completion status upon finishing their work.

This feature builds on top of the existing AI-DLC module (`ai_dlc_sessions`, `ai_dlc_artifacts`, `ai_approvals`, `ai_clarifications`) and the configurable SDLC workflow phases already present in the Platform Service.

## Glossary

- **Agent_Profile**: A configuration entity that defines an AI agent's role, capabilities, skill set, and the SDLC phase it operates in. Each profile maps to a specific role (BA, Dev, QA, DevOps, etc.).
- **Orchestration_Engine**: The core service responsible for decomposing workflow tasks, resolving dependencies, scheduling agent execution, and managing the lifecycle of running agents.
- **Agent_Instance**: A running instance of an Agent_Profile that has been started by the Orchestration_Engine to perform a specific task within a workflow execution.
- **Workflow_Execution**: A single run of an SDLC workflow for a project, consisting of one or more tasks assigned to agents across phases.
- **Task**: A discrete unit of work within a Workflow_Execution, assigned to a specific Agent_Instance. A task has a lifecycle: pending → assigned → running → done | failed.
- **Dependency_Graph**: A directed acyclic graph (DAG) representing the execution order constraints between tasks. Tasks without incoming edges can execute in parallel.
- **Completion_Callback**: The mechanism by which an Agent_Instance reports its task result (success with artifacts, or failure with error details) back to the Orchestration_Engine.
- **Phase_Agent_Mapping**: The configuration that associates each SDLC workflow phase with one or more Agent_Profiles that are qualified to perform work in that phase.
- **Artifact_Output**: The deliverable produced by an Agent_Instance upon task completion (e.g., a requirements document, test plan, deployment script).

## Requirements

### Requirement 1: Agent Profile Registry

**User Story:** As a Project Owner, I want to define and manage agent profiles with specific roles and skill sets, so that the system knows which agent to assign for each type of SDLC work.

#### Acceptance Criteria

1. THE Agent_Profile_Registry SHALL store agent profiles with the following attributes: name, role (BA, Dev, QA, DevOps, Designer, SRE), description, skill set, and supported SDLC phases.
2. WHEN a Project Owner creates a new agent profile, THE Agent_Profile_Registry SHALL validate that the profile has at least one supported SDLC phase and a non-empty skill set.
3. WHEN a Project Owner updates an agent profile that is currently referenced by a running Workflow_Execution, THE Agent_Profile_Registry SHALL reject the update and return an error indicating active usage.
4. THE Agent_Profile_Registry SHALL provide a default set of agent profiles (BA_Agent, Dev_Agent, QA_Agent, DevOps_Agent) that are available to all projects without manual configuration.
5. WHEN a Project Owner deletes an agent profile, THE Agent_Profile_Registry SHALL verify that no Phase_Agent_Mapping references the profile before allowing deletion.

### Requirement 2: SDLC Phase-to-Agent Mapping

**User Story:** As a Project Owner, I want to map each SDLC workflow phase to one or more agent profiles, so that the system automatically knows which agent to start when a phase begins.

#### Acceptance Criteria

1. THE Phase_Agent_Mapping SHALL allow associating one or more Agent_Profiles with each SDLC workflow phase defined in the project.
2. WHEN a Phase_Agent_Mapping is created, THE System SHALL validate that the referenced Agent_Profile supports the target SDLC phase.
3. THE Phase_Agent_Mapping SHALL support a priority order when multiple agents are mapped to the same phase, determining which agent is primary and which are secondary.
4. IF a workflow phase has no Phase_Agent_Mapping configured, THEN THE Orchestration_Engine SHALL skip automated agent assignment for that phase and log a warning.
5. WHEN the SDLC workflow phases for a project are modified, THE System SHALL notify the Project Owner of any Phase_Agent_Mappings that reference removed phases.

### Requirement 3: Orchestration Engine — Task Decomposition

**User Story:** As a team, I want the system to automatically break down workflow tasks by SDLC step and assign them to the appropriate agents, so that work progresses without manual coordination.

#### Acceptance Criteria

1. WHEN a Workflow_Execution is initiated, THE Orchestration_Engine SHALL decompose the workflow into individual Tasks based on the project's configured SDLC phases and Phase_Agent_Mappings.
2. THE Orchestration_Engine SHALL generate a Dependency_Graph for all Tasks within a Workflow_Execution, identifying which tasks depend on the output of other tasks.
3. WHEN decomposing tasks, THE Orchestration_Engine SHALL use the Phase_Agent_Mapping to assign each Task to the appropriate Agent_Profile based on the SDLC phase the task belongs to.
4. THE Orchestration_Engine SHALL persist the Dependency_Graph and task assignments in the database before starting any Agent_Instance.
5. IF the Orchestration_Engine cannot resolve an Agent_Profile for a required task, THEN THE Orchestration_Engine SHALL mark the Workflow_Execution as "blocked" and notify the Project Owner with the unresolved phase details.

### Requirement 4: Parallel Execution of Independent Tasks

**User Story:** As a team, I want tasks that have no dependencies on each other to run simultaneously, so that the workflow completes faster.

#### Acceptance Criteria

1. THE Orchestration_Engine SHALL identify all tasks in the Dependency_Graph that have no unresolved incoming dependencies and mark them as eligible for parallel execution.
2. WHEN multiple tasks are eligible for parallel execution, THE Orchestration_Engine SHALL start their corresponding Agent_Instances concurrently without waiting for sequential completion.
3. THE Orchestration_Engine SHALL enforce a configurable maximum concurrency limit per Workflow_Execution to prevent resource exhaustion.
4. WHEN a task completes, THE Orchestration_Engine SHALL re-evaluate the Dependency_Graph and start any newly unblocked tasks that depended on the completed task.
5. IF two tasks are mapped to the same SDLC phase but have no dependency between them, THEN THE Orchestration_Engine SHALL execute them in parallel.

### Requirement 5: Agent Lifecycle Management

**User Story:** As a system operator, I want each agent instance to follow a well-defined lifecycle (pending → running → done/failed), so that the system can track progress and handle failures gracefully.

#### Acceptance Criteria

1. THE Orchestration_Engine SHALL manage Agent_Instances through the following lifecycle states: pending, starting, running, done, failed, timed_out.
2. WHEN an Agent_Instance is started, THE Orchestration_Engine SHALL record the start timestamp and transition the instance state from "pending" to "starting", then to "running" once the agent confirms readiness.
3. IF an Agent_Instance does not confirm readiness within a configurable startup timeout, THEN THE Orchestration_Engine SHALL mark the instance as "failed" with a timeout reason and attempt to start a replacement instance up to a configurable retry limit.
4. WHILE an Agent_Instance is in "running" state, THE Orchestration_Engine SHALL monitor the instance via periodic heartbeat checks at a configurable interval.
5. IF an Agent_Instance misses consecutive heartbeat checks exceeding a configurable threshold, THEN THE Orchestration_Engine SHALL mark the instance as "failed" and trigger the failure handling workflow.
6. WHEN an Agent_Instance transitions to "done" or "failed" state, THE Orchestration_Engine SHALL record the end timestamp and the total execution duration.

### Requirement 6: Completion Notification and Callback

**User Story:** As a Project Owner, I want to be notified when an agent finishes its task, so that I can review the output and the workflow can proceed to the next step.

#### Acceptance Criteria

1. WHEN an Agent_Instance completes its task successfully, THE Agent_Instance SHALL send a Completion_Callback to the Orchestration_Engine containing: task ID, completion status ("done"), and a list of Artifact_Outputs produced.
2. WHEN the Orchestration_Engine receives a Completion_Callback with status "done", THE Orchestration_Engine SHALL store the Artifact_Outputs, update the task status, and evaluate downstream dependencies.
3. WHEN an Agent_Instance fails its task, THE Agent_Instance SHALL send a Completion_Callback with status "failed" and an error description.
4. WHEN the Orchestration_Engine receives a Completion_Callback with status "failed", THE Orchestration_Engine SHALL notify the Project Owner via the configured notification channel (in-app notification, Slack, or Teams).
5. WHEN all tasks in a Workflow_Execution reach a terminal state (done or failed), THE Orchestration_Engine SHALL mark the Workflow_Execution as "completed" and send a summary notification to the Project Owner.
6. THE Completion_Callback SHALL include the execution duration and resource usage metrics for observability purposes.

### Requirement 7: Artifact Output Management

**User Story:** As a team member, I want each agent to produce and store its deliverables (documents, code, test plans) as artifacts, so that downstream agents and team members can access them.

#### Acceptance Criteria

1. WHEN an Agent_Instance produces an Artifact_Output, THE System SHALL store the artifact with metadata: artifact type, name, content reference, producing agent profile, producing task ID, and creation timestamp.
2. THE System SHALL support the following artifact types: document, code, test_plan, deployment_script, review_report, and custom.
3. WHEN a downstream task depends on an upstream task's output, THE Orchestration_Engine SHALL make the upstream Artifact_Outputs available to the downstream Agent_Instance as input context.
4. THE System SHALL link Artifact_Outputs to the existing `ai_dlc_artifacts` table to maintain compatibility with the AI-DLC module.
5. WHEN a Workflow_Execution completes, THE System SHALL provide a consolidated view of all Artifact_Outputs produced during the execution, grouped by SDLC phase.

### Requirement 8: Workflow Execution Monitoring

**User Story:** As a Project Owner, I want to monitor the progress of a running workflow execution in real time, so that I can identify bottlenecks and intervene when needed.

#### Acceptance Criteria

1. THE System SHALL provide a real-time dashboard showing the current state of all tasks within a Workflow_Execution, including: task name, assigned agent, current state, start time, and elapsed duration.
2. THE System SHALL visualize the Dependency_Graph with color-coded task states (pending: gray, running: blue, done: green, failed: red).
3. WHEN a task has been running longer than a configurable duration threshold, THE System SHALL highlight the task as "at risk" on the monitoring dashboard.
4. THE System SHALL display the overall Workflow_Execution progress as a percentage of completed tasks relative to total tasks.
5. WHEN a Project Owner views the monitoring dashboard, THE System SHALL show the critical path through the Dependency_Graph highlighting which tasks determine the minimum completion time.

### Requirement 9: Workflow Execution Control

**User Story:** As a Project Owner, I want to start, pause, resume, and cancel workflow executions, so that I have full control over automated processes.

#### Acceptance Criteria

1. WHEN a Project Owner initiates a Workflow_Execution, THE Orchestration_Engine SHALL validate the project's Phase_Agent_Mappings and Dependency_Graph before starting execution.
2. WHEN a Project Owner pauses a Workflow_Execution, THE Orchestration_Engine SHALL allow currently running Agent_Instances to complete their current task but SHALL NOT start any new tasks.
3. WHEN a Project Owner resumes a paused Workflow_Execution, THE Orchestration_Engine SHALL re-evaluate the Dependency_Graph and start all eligible tasks.
4. WHEN a Project Owner cancels a Workflow_Execution, THE Orchestration_Engine SHALL send termination signals to all running Agent_Instances and mark all pending tasks as "cancelled".
5. IF a cancellation signal fails to terminate an Agent_Instance within a configurable grace period, THEN THE Orchestration_Engine SHALL force-terminate the instance and log the forced termination event.

### Requirement 10: Integration with Existing AI-DLC Module

**User Story:** As a developer, I want the agent workflow automation to integrate seamlessly with the existing AI-DLC module, so that agent sessions and artifacts are tracked consistently.

#### Acceptance Criteria

1. WHEN an Agent_Instance is started, THE System SHALL create a corresponding record in the `ai_dlc_sessions` table linking the session to the Workflow_Execution and Task.
2. WHEN an Agent_Instance produces an Artifact_Output, THE System SHALL create a corresponding record in the `ai_dlc_artifacts` table with the appropriate session reference.
3. WHEN an Agent_Instance requires human approval (e.g., for a critical document), THE System SHALL use the existing `ai_approvals` table and approval workflow.
4. WHEN an Agent_Instance needs clarification from a team member, THE System SHALL use the existing `ai_clarifications` table to record the question and response.
5. THE System SHALL expose agent workflow data through the existing AI-DLC API endpoints with additional query parameters for filtering by Workflow_Execution.
