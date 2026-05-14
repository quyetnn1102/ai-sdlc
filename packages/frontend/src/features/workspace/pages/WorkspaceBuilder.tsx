/**
 * WorkspaceBuilder — Main workspace page at /projects/:id/workspace.
 * Renders agents, skills, and pipelines as categorized card grids.
 * Supports drag-and-drop reordering, inline skill editing, and action buttons.
 */
import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@/lib/hooks';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { WorkspaceCard, type CardType } from '../components/WorkspaceCard';
import { SkillEditor } from '../components/SkillEditor';
import { WorkspaceInspector } from '../components/WorkspaceInspector';
import { WorkspaceSidebar } from '../components/WorkspaceSidebar';
import { AddSkillWizard } from '../components/wizards/AddSkillWizard';
import { AddAgentWizard } from '../components/wizards/AddAgentWizard';
import { AddPipelineWizard } from '../components/wizards/AddPipelineWizard';
import { SaveTemplateDialog } from '../components/wizards/SaveTemplateDialog';
import { LoadDemoDialog } from '../components/wizards/LoadDemoDialog';
import { StatusBarTokenIndicator } from '../components/StatusBarTokenIndicator';
import {
  skillsApi,
  pipelinesApi,
  workspaceApi,
  demoApi,
  type Skill,
  type Pipeline,
} from '../api/workspace.service';

interface CardItem {
  id: string;
  name: string;
  type: CardType;
  summary: string;
  displayOrder: number;
}

export function WorkspaceBuilder() {
  const { id: projectId } = useParams<{ id: string }>();

  // Data fetching
  const { data: skills, loading: skillsLoading, refetch: refetchSkills } = useQuery(
    () => skillsApi.list(projectId!),
    [projectId],
  );
  const { data: pipelines, loading: pipelinesLoading, refetch: refetchPipelines } = useQuery(
    () => pipelinesApi.list(projectId!),
    [projectId],
  );
  const { data: status, refetch: refetchStatus } = useQuery(
    () => workspaceApi.getStatus(projectId!),
    [projectId],
  );

  // UI state
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [viewingPipelineId, setViewingPipelineId] = useState<string | null>(null);
  const [showInspector, setShowInspector] = useState(false);
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [showAddPipeline, setShowAddPipeline] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showLoadDemo, setShowLoadDemo] = useState(false);
  const [dragSource, setDragSource] = useState<{ type: CardType; index: number } | null>(null);
  const [saving, setSaving] = useState(false);

  // Build card items from data
  const skillCards: CardItem[] = (skills ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    type: 'skill' as CardType,
    summary: s.description || 'No description',
    displayOrder: s.displayOrder,
  }));

  const pipelineCards: CardItem[] = (pipelines ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    type: 'pipeline' as CardType,
    summary: p.description || `${p.steps.length} steps`,
    displayOrder: p.displayOrder,
  }));

  // Agent cards from status (agents are managed via the existing agents page)
  const agentCount = status?.agents ?? 0;

  // Drag-and-drop handlers
  const handleDragStart = useCallback((type: CardType, index: number) => {
    setDragSource({ type, index });
  }, []);

  const handleDrop = useCallback(
    async (type: CardType, targetIndex: number) => {
      if (!dragSource || dragSource.type !== type) {
        setDragSource(null);
        return;
      }
      const sourceIndex = dragSource.index;
      setDragSource(null);
      if (sourceIndex === targetIndex) return;

      // Optimistic reorder for skills
      if (type === 'skill' && skills) {
        const reordered = [...skills];
        const [moved] = reordered.splice(sourceIndex, 1);
        reordered.splice(targetIndex, 0, moved);
        // Update display orders via API
        try {
          await skillsApi.update(projectId!, moved.id, { displayOrder: targetIndex });
          refetchSkills();
        } catch {
          refetchSkills(); // rollback
        }
      }
    },
    [dragSource, skills, projectId, refetchSkills],
  );

  // Inline skill editing
  const editingSkill = skills?.find((s) => s.id === editingSkillId);

  const handleSaveSkill = useCallback(
    async (content: string) => {
      if (!editingSkillId || !projectId) return;
      setSaving(true);
      try {
        await skillsApi.update(projectId, editingSkillId, { content });
        setEditingSkillId(null);
        refetchSkills();
      } finally {
        setSaving(false);
      }
    },
    [editingSkillId, projectId, refetchSkills],
  );

  const handleDeleteSkill = useCallback(
    async (id: string) => {
      if (!projectId) return;
      await skillsApi.delete(projectId, id);
      refetchSkills();
    },
    [projectId, refetchSkills],
  );

  const handleDeletePipeline = useCallback(
    async (id: string) => {
      if (!projectId) return;
      await pipelinesApi.delete(projectId, id);
      refetchPipelines();
    },
    [projectId, refetchPipelines],
  );

  const refetchAll = useCallback(() => {
    refetchSkills();
    refetchPipelines();
    refetchStatus();
  }, [refetchSkills, refetchPipelines, refetchStatus]);

  const loading = skillsLoading || pipelinesLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-8">
        <PageHeader
          title="Workspace Builder"
          description="Compose and manage your AI-driven development lifecycle workspace."
          breadcrumbs={[{ label: 'Projects' }, { label: 'Workspace' }]}
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBarTokenIndicator />
              <Button size="sm" onClick={() => setShowAddSkill(true)}>+ Skill</Button>
              <Button size="sm" onClick={() => setShowAddAgent(true)}>+ Agent</Button>
              <Button size="sm" onClick={() => setShowAddPipeline(true)}>+ Pipeline</Button>
              <Button variant="secondary" size="sm" onClick={() => setShowLoadDemo(true)}>Load Demo</Button>
              <Button variant="secondary" size="sm" onClick={() => setShowSaveTemplate(true)}>Save Template</Button>
              <Button variant="ghost" size="sm" onClick={() => setShowInspector(true)}>Inspect</Button>
            </div>
          }
        />

        {/* Inline skill editor */}
        {editingSkill && (
          <div className="rounded-xl bg-bg-surface border border-border-subtle p-4">
            <h3 className="text-sm font-medium text-text-primary mb-3">
              Editing: {editingSkill.name}
            </h3>
            <SkillEditor
              initialContent={editingSkill.content}
              onSave={handleSaveSkill}
              onCancel={() => setEditingSkillId(null)}
              saving={saving}
            />
          </div>
        )}

        {/* Inspector panel */}
        {showInspector && (
          <WorkspaceInspector
            projectId={projectId!}
            onClose={() => setShowInspector(false)}
          />
        )}

        {/* Agents section */}
        <section>
          <h2 className="text-[13px] font-medium text-text-secondary uppercase tracking-wide mb-3">
            Agents ({agentCount})
          </h2>
          {agentCount === 0 ? (
            <EmptyState
              title="No agents configured"
              description="Add an agent to start building your workspace."
              action={<Button size="sm" onClick={() => setShowAddAgent(true)}>+ Add Agent</Button>}
            />
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm text-text-secondary">
                {agentCount} agent{agentCount !== 1 ? 's' : ''} configured.
              </p>
              <a
                href={`/projects/${projectId}/agents`}
                className="text-sm text-accent-primary hover:underline"
              >
                Manage agents →
              </a>
            </div>
          )}
        </section>

        {/* Skills section */}
        <section>
          <h2 className="text-[13px] font-medium text-text-secondary uppercase tracking-wide mb-3">
            Skills ({skillCards.length})
          </h2>
          {skillCards.length === 0 ? (
            <EmptyState
              title="No skills yet"
              description="Skills are reusable prompt templates for your agents."
              action={<Button size="sm" onClick={() => setShowAddSkill(true)}>+ Add Skill</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {skillCards.map((card, index) => (
                <WorkspaceCard
                  key={card.id}
                  id={card.id}
                  name={card.name}
                  type={card.type}
                  summary={card.summary}
                  onClick={() => setEditingSkillId(card.id)}
                  onEdit={() => setEditingSkillId(card.id)}
                  onDelete={() => handleDeleteSkill(card.id)}
                  onDragStart={() => handleDragStart('skill', index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop('skill', index)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Pipelines section */}
        <section>
          <h2 className="text-[13px] font-medium text-text-secondary uppercase tracking-wide mb-3">
            Pipelines ({pipelineCards.length})
          </h2>
          {pipelineCards.length === 0 ? (
            <EmptyState
              title="No pipelines yet"
              description="Pipelines chain agents into sequential workflows."
              action={<Button size="sm" onClick={() => setShowAddPipeline(true)}>+ Add Pipeline</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pipelineCards.map((card, index) => (
                <WorkspaceCard
                  key={card.id}
                  id={card.id}
                  name={card.name}
                  type={card.type}
                  summary={card.summary}
                  onClick={() => setViewingPipelineId(card.id)}
                  onDelete={() => handleDeletePipeline(card.id)}
                  onDragStart={() => handleDragStart('pipeline', index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop('pipeline', index)}
                />
              ))}
            </div>
          )}

          {/* Pipeline detail panel */}
          {viewingPipelineId && pipelines && (() => {
            const pipeline = pipelines.find((p) => p.id === viewingPipelineId);
            if (!pipeline) return null;
            return (
              <div className="mt-3 rounded-xl bg-bg-surface border border-border-subtle p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-text-primary">{pipeline.name}</h3>
                  <Button size="sm" variant="ghost" onClick={() => setViewingPipelineId(null)}>Close</Button>
                </div>
                {pipeline.description && (
                  <p className="text-xs text-text-secondary mb-3">{pipeline.description}</p>
                )}
                <div className="space-y-2">
                  {pipeline.steps.map((step, i) => (
                    <div key={step.id} className="flex items-center gap-3 p-2 rounded-lg bg-bg-elevated">
                      <span className="w-6 h-6 rounded-full bg-bg-surface flex items-center justify-center text-xs font-medium text-text-secondary">{i + 1}</span>
                      <span className="text-sm text-text-primary flex-1">Agent: {step.agentProfileId}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded ${step.onFailure === 'stop' ? 'bg-[rgba(239,68,68,0.1)] text-status-danger' : 'bg-[rgba(245,158,11,0.1)] text-status-warning'}`}>
                        on-fail: {step.onFailure}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </section>
      </div>

      {/* Sidebar */}
      <WorkspaceSidebar projectId={projectId!} />

      {/* Wizard dialogs */}
      <AddSkillWizard
        open={showAddSkill}
        onClose={() => setShowAddSkill(false)}
        projectId={projectId!}
        onSuccess={refetchAll}
      />
      <AddAgentWizard
        open={showAddAgent}
        onClose={() => setShowAddAgent(false)}
        projectId={projectId!}
        onSuccess={refetchAll}
      />
      <AddPipelineWizard
        open={showAddPipeline}
        onClose={() => setShowAddPipeline(false)}
        projectId={projectId!}
        onSuccess={refetchAll}
      />
      <SaveTemplateDialog
        open={showSaveTemplate}
        onClose={() => setShowSaveTemplate(false)}
        projectId={projectId!}
      />
      <LoadDemoDialog
        open={showLoadDemo}
        onClose={() => setShowLoadDemo(false)}
        projectId={projectId!}
        onSuccess={refetchAll}
      />
    </div>
  );
}
