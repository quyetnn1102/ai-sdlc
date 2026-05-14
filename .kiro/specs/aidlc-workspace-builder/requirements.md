# Requirements Document

## Introduction

The AIDLC Workspace Builder extends the SDLC Hub web application with a visual workspace for composing, managing, and executing AI-driven development lifecycle (AIDLC) pipelines. It introduces first-class Skill and Pipeline entities, a workspace configuration layer (workspace.yaml), and a suite of wizards and tools that allow users to build, template, inspect, and run AIDLC workflows without writing YAML manually. The feature set spans 11 capabilities: a drag-and-drop workspace builder panel, epic-bound pipeline runs with approval gates, a sidebar status panel, a demo project loader, skill/agent/pipeline creation wizards, workspace templates, an embedded Claude CLI console, a workspace inspector, and an interactive walkthrough.

## Glossary

- **Workspace_Builder**: The main-area panel in the SDLC Hub frontend that displays agent, skill, and pipeline cards in a visual layout and supports drag-and-drop reordering, on-failure toggle configuration, and inline skill editing.
- **Skill**: A standalone, reusable unit of agent capability defined as a markdown document with structured metadata (name, description, inputs, outputs, prompt template). Skills replace the current string-based skillSet arrays on agent profiles.
- **Pipeline**: An ordered chain of agents with defined execution order and per-step on-failure behavior (stop or continue). Pipelines replace the current phase-to-agent mapping concept for AIDLC workflows.
- **Epic_Run**: A pipeline execution instance bound to a specific work item (epic). It walks the pipeline step-by-step, supports approval gates between steps, rejection with feedback cascading, and rerun with optional new context.
- **Workspace_Configuration**: A YAML-based configuration file (workspace.yaml) stored per project that declares agents, skills, pipelines, slash commands, and workspace metadata. This supplements the existing database-stored configuration.
- **Sidebar_Panel**: A persistent left-side panel in the web application that displays live counts of agents, skills, and pipelines, active run status, and available slash commands declared in workspace.yaml.
- **Demo_Project**: A pre-built AIDLC workspace configuration containing a full SDLC pipeline and 6 sample epics that can be loaded with one click to bootstrap a project without manual YAML authoring.
- **Skill_Wizard**: A multi-source creation dialog for adding new skills from templates, pasted markdown, uploaded .md files, or a blank editor.
- **Agent_Wizard**: A creation dialog for defining new agents with an ID, display name, skill selection, and model picker.
- **Pipeline_Wizard**: A creation dialog for chaining agents into a pipeline with configurable on-failure behavior per step.
- **Workspace_Template**: A named, reusable snapshot of an entire workspace configuration (agents, skills, pipelines) that can be saved and reapplied across projects.
- **Claude_Console**: An embedded terminal panel in the web application that launches a Claude CLI session for direct AI interaction.
- **Workspace_Inspector**: A diagnostic tool that parses, validates, and environment-resolves the workspace.yaml file and displays the result in an output panel.
- **Interactive_Walkthrough**: A guided 6-step tour accessible from the Welcome page that introduces users to AIDLC workspace concepts and actions.
- **On_Failure_Behavior**: A per-step pipeline configuration that determines whether execution stops or continues when a step fails.
- **Slash_Command**: A named command declared in workspace.yaml that can be invoked from the sidebar panel or Claude console to trigger predefined actions.

## Requirements

### Requirement 1: Workspace Builder Panel

**User Story:** As a Project Owner, I want a visual workspace builder panel where I can see and arrange my agents, skills, and pipelines as cards, so that I can compose AIDLC workflows without editing YAML directly.

#### Acceptance Criteria

1. WHEN the user navigates to the AIDLC Workspace page, THE Workspace_Builder SHALL render all agents, skills, and pipelines for the current project as distinct card types in a categorized layout.
2. WHEN the user drags a card to a new position within its category, THE Workspace_Builder SHALL persist the new display order to the backend.
3. WHEN the user toggles the on-failure behavior on a pipeline step card, THE Workspace_Builder SHALL update the pipeline configuration to reflect the selected behavior (stop or continue).
4. WHEN the user clicks the inline edit action on a skill card, THE Workspace_Builder SHALL open an inline markdown editor pre-populated with the skill content.
5. WHEN the user saves changes in the inline skill editor, THE Workspace_Builder SHALL validate the skill markdown structure and persist the updated content to the backend.
6. IF the skill markdown is structurally invalid, THEN THE Workspace_Builder SHALL display a validation error message identifying the structural issue and prevent saving.
7. THE Workspace_Builder SHALL display each card with its name, type badge, and a summary of its configuration (skill count for agents, step count for pipelines, input/output count for skills).

### Requirement 2: Epics and Pipeline Runs

**User Story:** As a Developer, I want to bind a pipeline to a work item and walk it step-by-step with approval gates, so that I can execute AI-driven workflows with human oversight at each stage.

#### Acceptance Criteria

1. WHEN the user selects a pipeline and a work item, THE Epic_Run SHALL create a new run instance binding the pipeline to that work item with status "pending".
2. WHEN a pipeline step completes successfully, THE Epic_Run SHALL pause execution and present an approval prompt to the user before advancing to the next step.
3. WHEN the user approves a completed step, THE Epic_Run SHALL advance execution to the next step in the pipeline.
4. WHEN the user rejects a completed step with feedback, THE Epic_Run SHALL cascade the rejection feedback to the producing step and auto-reset all downstream steps to "pending" status.
5. WHEN the user initiates a rerun on a rejected step, THE Epic_Run SHALL re-execute that step with the rejection feedback as additional context.
6. WHEN the user provides optional new context during a rerun, THE Epic_Run SHALL include the new context alongside the rejection feedback for the re-execution.
7. IF a pipeline step fails due to an agent error, THEN THE Epic_Run SHALL apply the configured on-failure behavior (stop the run or mark the step as failed and continue to the next step).
8. THE Epic_Run SHALL maintain a complete execution history including all approvals, rejections, reruns, and their timestamps for audit purposes.

### Requirement 3: Sidebar Status Panel

**User Story:** As a Developer, I want a persistent sidebar panel showing live workspace status, so that I can monitor my AIDLC workspace health and access commands without navigating away from my current view.

#### Acceptance Criteria

1. THE Sidebar_Panel SHALL display the current count of agents, skills, and pipelines defined in the active project workspace.
2. THE Sidebar_Panel SHALL display the number and status of active Epic_Run instances (running, paused awaiting approval, failed).
3. WHEN the workspace configuration changes (agent/skill/pipeline added or removed), THE Sidebar_Panel SHALL update its counts within 5 seconds without requiring a page refresh.
4. THE Sidebar_Panel SHALL list all slash commands declared in the project workspace.yaml file with their names and descriptions.
5. WHEN the user clicks a slash command in the sidebar, THE Sidebar_Panel SHALL execute the associated command action and display the result in the output area.
6. IF the workspace.yaml file is missing or unparseable, THEN THE Sidebar_Panel SHALL display a warning indicator with a message directing the user to run the Workspace Inspector.

### Requirement 4: Load Demo Project

**User Story:** As a new user, I want to load a complete demo AIDLC workspace with one click, so that I can explore the system without writing any configuration from scratch.

#### Acceptance Criteria

1. WHEN the user clicks the "Load Demo Project" action, THE Demo_Project SHALL create a complete workspace configuration containing a full SDLC pipeline with agents for each phase (BA, Dev, QA, DevOps).
2. WHEN the demo project is loaded, THE Demo_Project SHALL create 6 sample epic work items with varied complexity levels bound to the demo pipeline.
3. WHEN the demo project is loaded, THE Demo_Project SHALL generate a valid workspace.yaml file in the project workspace storage with all agents, skills, pipelines, and slash commands declared.
4. IF the project already has an existing workspace configuration, THEN THE Demo_Project SHALL prompt the user for confirmation before overwriting and offer to merge or replace.
5. WHEN the demo project loading completes, THE Demo_Project SHALL navigate the user to the Workspace Builder panel with the loaded configuration visible.
6. THE Demo_Project SHALL complete the loading operation within 10 seconds for a project with no existing workspace data.

### Requirement 5: Add Skill Wizard

**User Story:** As a Project Owner, I want multiple ways to create skills (from templates, pasted content, file upload, or blank), so that I can quickly add capabilities to my agents regardless of how I prefer to author content.

#### Acceptance Criteria

1. WHEN the user opens the Add Skill wizard, THE Skill_Wizard SHALL present four source options: load from template, paste markdown, upload a .md file, or open a blank editor.
2. WHEN the user selects "load from template", THE Skill_Wizard SHALL display the available starter templates: hello-world, code-reviewer, test-converter, doc-writer, and release-notes.
3. WHEN the user selects a template, THE Skill_Wizard SHALL populate the skill editor with the template content including pre-filled metadata (name, description, inputs, outputs, prompt).
4. WHEN the user selects "paste markdown", THE Skill_Wizard SHALL provide a text area for pasting markdown content and validate the pasted content against the skill schema on submission.
5. WHEN the user selects "upload a .md file", THE Skill_Wizard SHALL accept a single .md file upload with a maximum size of 1 MB and parse its content into the skill editor.
6. WHEN the user selects "blank editor", THE Skill_Wizard SHALL open the skill editor with an empty skill scaffold containing required metadata field placeholders.
7. WHEN the user submits the completed skill, THE Skill_Wizard SHALL validate all required fields (name, description, prompt template) and persist the skill to the backend.
8. IF required fields are missing or the skill name conflicts with an existing skill in the project, THEN THE Skill_Wizard SHALL display specific validation errors and prevent submission.

### Requirement 6: Add Agent Wizard

**User Story:** As a Project Owner, I want a guided wizard to create new agents with skill and model selection, so that I can define agent capabilities without manually editing configuration files.

#### Acceptance Criteria

1. WHEN the user opens the Add Agent wizard, THE Agent_Wizard SHALL present a form with fields for: agent ID (auto-generated slug), display name, skill picker, and model picker.
2. THE Agent_Wizard SHALL populate the skill picker with all skills defined in the current project workspace, allowing multi-select.
3. THE Agent_Wizard SHALL populate the model picker with the available models: Sonnet 4.6, Opus 4.7, and Haiku 4.5.
4. WHEN the user enters a display name, THE Agent_Wizard SHALL auto-generate a kebab-case agent ID from the display name and allow manual override.
5. WHEN the user submits the agent form, THE Agent_Wizard SHALL validate that at least one skill is selected and a model is chosen, then persist the agent to the backend.
6. IF the agent ID conflicts with an existing agent in the project, THEN THE Agent_Wizard SHALL display a validation error and suggest an alternative ID.
7. WHEN the agent is successfully created, THE Agent_Wizard SHALL update the workspace.yaml file to include the new agent declaration and refresh the Workspace Builder panel.

### Requirement 7: Add Pipeline Wizard

**User Story:** As a Project Owner, I want a wizard to chain agents into a pipeline with failure handling, so that I can define multi-step AI workflows with clear error recovery behavior.

#### Acceptance Criteria

1. WHEN the user opens the Add Pipeline wizard, THE Pipeline_Wizard SHALL present a step-builder interface where agents can be added as sequential pipeline steps.
2. THE Pipeline_Wizard SHALL populate the agent selector with all agents defined in the current project workspace.
3. WHEN the user adds an agent as a pipeline step, THE Pipeline_Wizard SHALL display the step with a configurable on-failure behavior toggle defaulting to "stop".
4. WHEN the user reorders pipeline steps via drag-and-drop, THE Pipeline_Wizard SHALL update the execution order to reflect the new arrangement.
5. WHEN the user submits the pipeline, THE Pipeline_Wizard SHALL validate that the pipeline contains at least two steps and has a unique name, then persist it to the backend.
6. IF the pipeline name conflicts with an existing pipeline in the project, THEN THE Pipeline_Wizard SHALL display a validation error and prevent submission.
7. WHEN the pipeline is successfully created, THE Pipeline_Wizard SHALL update the workspace.yaml file to include the new pipeline declaration and refresh the Workspace Builder panel.

### Requirement 8: Workspace Templates

**User Story:** As a Project Owner, I want to save my workspace configuration as a reusable template and apply it to other projects, so that I can standardize AIDLC workflows across my organization.

#### Acceptance Criteria

1. WHEN the user selects "Save as Template" from the workspace actions menu, THE Workspace_Template SHALL capture the complete workspace configuration (agents, skills, pipelines, slash commands) as a named template.
2. WHEN saving a template, THE Workspace_Template SHALL require a unique template name and optional description.
3. WHEN the user applies a template to a project, THE Workspace_Template SHALL create all agents, skills, and pipelines defined in the template within the target project workspace.
4. IF the target project has existing workspace entities that conflict with template entities by name, THEN THE Workspace_Template SHALL prompt the user to skip, rename, or overwrite each conflicting entity.
5. THE Workspace_Template SHALL provide three built-in templates: "code-review" (code review pipeline with reviewer agent), "release-notes" (release notes generation pipeline), and "sdlc" (full SDLC pipeline with BA, Dev, QA, DevOps agents).
6. WHEN the user deletes a custom template, THE Workspace_Template SHALL remove the template from the template registry without affecting projects that previously applied it.
7. THE Workspace_Template SHALL store templates at the organization level, making them available to all projects within the organization.

### Requirement 9: Embedded Claude Console

**User Story:** As a Developer, I want an embedded terminal in the application where I can interact with Claude CLI directly, so that I can perform ad-hoc AI tasks without leaving the SDLC Hub interface.

#### Acceptance Criteria

1. WHEN the user opens the Claude Console from the bottom panel, THE Claude_Console SHALL render an interactive terminal emulator in the browser.
2. WHEN the Claude Console is opened, THE Claude_Console SHALL automatically initiate a connection to the backend terminal service with the Claude CLI pre-configured.
3. THE Claude_Console SHALL support standard terminal interactions including text input, command history (up/down arrows), and ANSI color rendering.
4. WHEN the user types a command in the console, THE Claude_Console SHALL send the input to the backend terminal service and stream the response back in real time.
5. IF the backend terminal service is unavailable, THEN THE Claude_Console SHALL display a connection error message with a retry action.
6. WHEN the user closes the Claude Console panel, THE Claude_Console SHALL terminate the backend terminal session and release associated resources.
7. THE Claude_Console SHALL support multiple concurrent console sessions per user, each displayed as a tab in the bottom panel.

### Requirement 10: Workspace Inspector

**User Story:** As a Project Owner, I want to inspect the fully resolved workspace configuration, so that I can verify that my workspace.yaml is valid and all environment variables are correctly substituted.

#### Acceptance Criteria

1. WHEN the user triggers the Workspace Inspector, THE Workspace_Inspector SHALL parse the project workspace.yaml file and validate it against the workspace schema.
2. WHEN parsing is successful, THE Workspace_Inspector SHALL resolve all environment variable references (e.g., ${ENV_VAR}) with their current values from the project environment configuration.
3. WHEN resolution is complete, THE Workspace_Inspector SHALL display the fully resolved workspace configuration in a formatted output panel with syntax highlighting.
4. IF the workspace.yaml contains syntax errors, THEN THE Workspace_Inspector SHALL display the parse errors with line numbers and descriptive messages.
5. IF environment variable references cannot be resolved, THEN THE Workspace_Inspector SHALL highlight unresolved references in the output and list them as warnings.
6. THE Workspace_Inspector SHALL display a validation summary indicating the total number of agents, skills, pipelines, and slash commands found, along with any validation warnings or errors.

### Requirement 11: Interactive Walkthrough

**User Story:** As a new user, I want a guided tour that introduces me to AIDLC workspace concepts step by step, so that I can learn the system quickly without reading external documentation.

#### Acceptance Criteria

1. WHEN the user clicks "Get started with AIDLC" on the Welcome page, THE Interactive_Walkthrough SHALL launch a 6-step guided tour overlay.
2. THE Interactive_Walkthrough SHALL highlight the relevant UI element for each step and display an explanatory tooltip with a description of the feature and a "Next" action.
3. THE Interactive_Walkthrough SHALL cover the following steps in order: (1) Workspace Builder overview, (2) Adding a skill, (3) Adding an agent, (4) Creating a pipeline, (5) Running an epic, (6) Using the sidebar panel.
4. WHEN the user clicks "Next" on a step, THE Interactive_Walkthrough SHALL advance to the next step, navigating to the appropriate page if the next step is on a different view.
5. WHEN the user clicks "Skip" or closes the walkthrough at any step, THE Interactive_Walkthrough SHALL dismiss the tour and record that the user has seen the walkthrough to prevent automatic re-display.
6. IF the user has not completed the walkthrough and visits the Welcome page, THEN THE Interactive_Walkthrough SHALL display a prompt offering to resume or restart the tour.
7. WHEN the user completes all 6 steps, THE Interactive_Walkthrough SHALL display a completion message with links to key actions (Load Demo Project, Add Skill, Create Pipeline).
