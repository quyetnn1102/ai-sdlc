/**
 * Workspace feature module — public API exports.
 */

// API service
export {
  skillsApi,
  pipelinesApi,
  epicRunsApi,
  workspaceApi,
  templatesApi,
  demoApi,
} from './api/workspace.service';

// Types
export type {
  Skill,
  SkillIO,
  SkillTemplate,
  SkillValidationResult,
  CreateSkillPayload,
  UpdateSkillPayload,
  Pipeline,
  PipelineStep,
  CreatePipelinePayload,
  UpdatePipelinePayload,
  ReorderStepsPayload,
  EpicRun,
  EpicRunStatus,
  EpicRunStep,
  EpicRunStepStatus,
  CreateEpicRunPayload,
  RejectStepPayload,
  RerunStepPayload,
  EpicRunHistoryEntry,
  WorkspaceConfig,
  SlashCommand,
  UpdateWorkspaceConfigPayload,
  WorkspaceYamlResponse,
  InspectResult,
  WorkspaceStatus,
  WorkspaceTemplate,
  CreateTemplatePayload,
  ApplyTemplatePayload,
  DemoLoadResult,
  DemoStatus,
} from './api/workspace.service';

// Hooks
export { useWorkspaceSocket } from './hooks/useWorkspaceSocket';
export type { WorkspaceSocketState, EpicRunProgressEvent } from './hooks/useWorkspaceSocket';

export { useTerminalSocket } from './hooks/useTerminalSocket';
export type { TerminalSocketState, TerminalOutputEvent, TerminalErrorEvent } from './hooks/useTerminalSocket';

// Components
export { WorkspaceCard } from './components/WorkspaceCard';
export type { WorkspaceCardProps, CardType } from './components/WorkspaceCard';

export { SkillEditor } from './components/SkillEditor';
export type { SkillEditorProps } from './components/SkillEditor';

export { PipelineStepBuilder } from './components/PipelineStepBuilder';
export type { PipelineStepBuilderProps, PipelineStepItem } from './components/PipelineStepBuilder';

export { ApprovalGateUI } from './components/ApprovalGateUI';
export type { ApprovalGateUIProps } from './components/ApprovalGateUI';

export { InspectorOutput } from './components/InspectorOutput';
export type { InspectorOutputProps } from './components/InspectorOutput';

export { WorkspaceInspector } from './components/WorkspaceInspector';
export { WorkspaceSidebar } from './components/WorkspaceSidebar';
export { ClaudeConsole } from './components/ClaudeConsole';
export { WalkthroughOverlay } from './components/WalkthroughOverlay';

// Wizards
export { AddSkillWizard } from './components/wizards/AddSkillWizard';
export { AddAgentWizard } from './components/wizards/AddAgentWizard';
export { AddPipelineWizard } from './components/wizards/AddPipelineWizard';
export { SaveTemplateDialog } from './components/wizards/SaveTemplateDialog';
export { LoadDemoDialog } from './components/wizards/LoadDemoDialog';

// Pages
export { WorkspaceBuilder } from './pages/WorkspaceBuilder';
export { EpicRunDetail } from './pages/EpicRunDetail';

// Routes
export { workspaceRoutes, workspaceNavEntry } from './routes';
