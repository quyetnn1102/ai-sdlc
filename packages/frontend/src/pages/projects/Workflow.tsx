import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@/lib/hooks';
import { workflowService, type WorkflowPhase, type CreatePhasePayload } from '@/services/workflow.service';
import { agentsService, type PhaseAgentMapping } from '@/services/agents.service';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { ApiError } from '@/lib/api';

const PHASE_COLORS = [
  '#6B7280','#3B82F6','#4F6EF7','#8B5CF6','#F59E0B','#22C55E','#10B981','#EF4444',
];

const MAPPING_SOURCES = [
  { value: 'JIRA', label: 'Jira' },
  { value: 'GITHUB', label: 'GitHub' },
  { value: 'GITLAB', label: 'GitLab' },
];

const roleColors: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  BA_AGENT: 'info', DEV_AGENT: 'success', QA_AGENT: 'warning',
  DEVOPS_AGENT: 'danger', DESIGNER_AGENT: 'neutral', SRE_AGENT: 'neutral',
};

function AgentChip({ mapping, onRemove }: { mapping: PhaseAgentMapping; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-bg-elevated border border-border-subtle">
      <Badge variant={roleColors[mapping.agentProfile.role] ?? 'neutral'} className="text-[10px]">
        {mapping.agentProfile.role.replace('_AGENT', '')}
      </Badge>
      <span className="text-xs text-text-primary">{mapping.agentProfile.name}</span>
      <button onClick={onRemove} className="text-[10px] text-text-disabled hover:text-status-danger transition-colors ml-0.5">✕</button>
    </div>
  );
}

function PhaseCard({
  phase, projectId, allMappings, agentProfiles, onRefetch, onRefetchMappings,
}: {
  phase: WorkflowPhase;
  projectId: string;
  allMappings: PhaseAgentMapping[];
  agentProfiles: Array<{ id: string; name: string; role: string; supportedPhases: string[] }>;
  onRefetch: () => void;
  onRefetchMappings: () => void;
}) {
  const [mappingOpen, setMappingOpen] = useState(false);
  const [mapStatus, setMapStatus] = useState('');
  const [mapSource, setMapSource] = useState('JIRA');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [agentPanelOpen, setAgentPanelOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [agentSaving, setAgentSaving] = useState(false);
  const [agentError, setAgentError] = useState('');

  const phaseMappings = allMappings.filter((m) => m.phaseId === phase.id);
  const compatibleAgents = agentProfiles.filter(
    (p) => p.supportedPhases.length === 0 ||
      p.supportedPhases.some((sp) => sp.toLowerCase() === phase.name.toLowerCase()),
  );
  const agentOptions = compatibleAgents.map((p) => ({
    value: p.id, label: `${p.name} (${p.role.replace('_AGENT', '')})`,
  }));

  async function addStatusMapping() {
    if (!mapStatus.trim()) return;
    setSaving(true);
    try {
      await workflowService.addMapping(projectId, phase.id, { externalStatus: mapStatus, source: mapSource });
      setMapStatus(''); setMappingOpen(false); onRefetch();
    } finally { setSaving(false); }
  }

  async function removeStatusMapping(id: string) {
    await workflowService.removeMapping(projectId, phase.id, id);
    setDeleteId(null); onRefetch();
  }

  async function addAgentMapping(e: React.FormEvent) {
    e.preventDefault(); if (!selectedAgentId) return;
    setAgentSaving(true); setAgentError('');
    try {
      await agentsService.createMapping(projectId, { phaseId: phase.id, agentProfileId: selectedAgentId });
      setSelectedAgentId(''); setAgentPanelOpen(false); onRefetchMappings();
    } catch (err) { setAgentError(err instanceof ApiError ? err.message : 'Failed to add mapping'); }
    finally { setAgentSaving(false); }
  }

  return (
    <div className="p-4 rounded-xl bg-bg-surface border border-border-subtle">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: phase.color }} />
        <span className="text-sm font-medium text-text-primary flex-1">{phase.name}</span>
        <span className="text-[11px] text-text-disabled bg-bg-elevated px-2 py-0.5 rounded">#{phase.order}</span>
      </div>

      <div className="space-y-1 mb-2">
        {phase.statusMappings.map((m) => (
          <div key={m.id} className="flex items-center justify-between px-2 py-1 rounded bg-bg-elevated">
            <span className="text-xs text-text-secondary"><span className="text-text-disabled">{m.source}:</span> {m.externalStatus}</span>
            <button onClick={() => setDeleteId(m.id)} className="text-[10px] text-text-disabled hover:text-status-danger transition-colors ml-2">✕</button>
          </div>
        ))}
        {phase.statusMappings.length === 0 && <p className="text-[11px] text-text-disabled px-2">No status mappings</p>}
      </div>

      <Button size="sm" variant="ghost" onClick={() => setMappingOpen(true)}>+ Add status mapping</Button>

      <div className="mt-4 pt-4 border-t border-border-subtle">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-wide text-text-disabled font-medium">Agent Assignments</span>
          <Button size="sm" variant="ghost" onClick={() => { setAgentPanelOpen(true); setAgentError(''); }}>+ Assign agent</Button>
        </div>
        {phaseMappings.length === 0 ? (
          <p className="text-[11px] text-text-disabled px-1">No agents assigned — workflow will skip this phase.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {phaseMappings.map((m) => (
              <AgentChip key={m.id} mapping={m} onRemove={() => agentsService.deleteMapping(projectId, m.id).then(onRefetchMappings)} />
            ))}
          </div>
        )}
      </div>

      <Modal open={mappingOpen} onClose={() => setMappingOpen(false)} title={`Map status → ${phase.name}`} size="sm"
        footer={<><Button variant="secondary" size="sm" onClick={() => setMappingOpen(false)}>Cancel</Button><Button size="sm" onClick={addStatusMapping} loading={saving}>Add</Button></>}>
        <div className="space-y-3">
          <Select label="Source" value={mapSource} onChange={(e) => setMapSource(e.target.value)} options={MAPPING_SOURCES} />
          <Input label="External status name" value={mapStatus} onChange={(e) => setMapStatus(e.target.value)} placeholder="e.g. In Progress" />
        </div>
      </Modal>

      <Modal open={agentPanelOpen} onClose={() => setAgentPanelOpen(false)} title={`Assign agent to "${phase.name}"`} size="sm"
        footer={<><Button variant="secondary" size="sm" onClick={() => setAgentPanelOpen(false)}>Cancel</Button><Button size="sm" form="assign-agent-form" type="submit" loading={agentSaving} disabled={!selectedAgentId}>Assign</Button></>}>
        {agentError && <div className="mb-3 text-sm text-status-danger bg-[rgba(239,68,68,0.1)] px-3 py-2 rounded-md">{agentError}</div>}
        <form id="assign-agent-form" onSubmit={addAgentMapping} className="space-y-3">
          {agentOptions.length === 0 ? (
            <p className="text-sm text-text-secondary">No compatible agents for "{phase.name}". Go to <strong>Agent Profiles</strong> to create one.</p>
          ) : (
            <Select label="Agent profile" value={selectedAgentId} options={agentOptions} placeholder="Select agent…" onChange={(e) => setSelectedAgentId(e.target.value)} />
          )}
        </form>
      </Modal>

      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && removeStatusMapping(deleteId)}
        title="Remove mapping" message="Remove this status mapping?" />
    </div>
  );
}

export function WorkflowPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { data: phases, loading, refetch } = useQuery(() => workflowService.listPhases(projectId!), [projectId]);
  const { data: agentProfiles } = useQuery(() => agentsService.listProfiles(projectId!), [projectId]);
  const { data: agentMappings, refetch: refetchMappings } = useQuery(() => agentsService.listMappings(projectId!), [projectId]);

  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean; issues: Array<{ phaseName: string; issue: string; message: string }>;
  } | null>(null);

  async function handleValidate() {
    setValidating(true);
    try { setValidationResult(await agentsService.validateMappings(projectId!)); }
    finally { setValidating(false); }
  }

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<CreatePhasePayload>({ name: '', order: 1, color: '#6B7280' });
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      await workflowService.createPhase(projectId!, { ...form, order: (phases?.length ?? 0) + 1 });
      setAddOpen(false); setForm({ name: '', order: 1, color: '#6B7280' }); refetch();
    } finally { setSaving(false); }
  }

  return (
    <div>
      <PageHeader title={t('projects.workflow')}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={handleValidate} loading={validating}>Validate agent mappings</Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>+ Add phase</Button>
          </div>
        }
      />

      {validationResult && (
        <div className={`mb-4 px-4 py-3 rounded-lg border text-sm ${validationResult.valid
          ? 'bg-[rgba(34,197,94,0.08)] border-[rgba(34,197,94,0.3)] text-status-success'
          : 'bg-[rgba(245,158,11,0.08)] border-[rgba(15, 15, 13, 0.3)] text-status-warning'}`}>
          {validationResult.valid ? <span>✓ All phases have valid agent mappings.</span> : (
            <div>
              <p className="font-medium mb-1">⚠ {validationResult.issues.length} mapping issue(s) found:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {validationResult.issues.map((issue, i) => <li key={i} className="text-xs text-text-secondary">{issue.message}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-24 rounded-xl bg-bg-surface border border-border-subtle animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {(phases ?? []).map((phase) => (
            <PhaseCard key={phase.id} phase={phase} projectId={projectId!}
              allMappings={agentMappings ?? []} agentProfiles={agentProfiles ?? []}
              onRefetch={refetch} onRefetchMappings={refetchMappings} />
          ))}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add workflow phase" size="sm"
        footer={<><Button variant="secondary" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button><Button size="sm" form="add-phase-form" type="submit" loading={saving}>Add</Button></>}>
        <form id="add-phase-form" onSubmit={handleAdd} className="space-y-4">
          <Input label="Phase name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <div>
            <label className="text-xs text-text-secondary mb-1.5 block">Color</label>
            <div className="flex gap-2 flex-wrap">
              {PHASE_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                  className="w-6 h-6 rounded-full border-2 transition-all"
                  style={{ backgroundColor: c, borderColor: form.color === c ? 'white' : 'transparent' }} />
              ))}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
