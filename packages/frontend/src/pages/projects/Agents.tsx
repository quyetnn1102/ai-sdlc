import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@/lib/hooks';
import {
  agentsService,
  type AgentProfile,
  type CreateAgentProfilePayload,
} from '@/services/agents.service';
import { workflowService } from '@/services/workflow.service';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { ApiError } from '@/lib/api';

const ROLES = [
  { value: 'BA_AGENT',       label: 'BA Agent — Business Analyst' },
  { value: 'DEV_AGENT',      label: 'Dev Agent — Software Developer' },
  { value: 'QA_AGENT',       label: 'QA Agent — Quality Assurance' },
  { value: 'DEVOPS_AGENT',   label: 'DevOps Agent — Release Engineer' },
  { value: 'DESIGNER_AGENT', label: 'Designer Agent — UX/UI Designer' },
  { value: 'SRE_AGENT',      label: 'SRE Agent — Site Reliability' },
];

const LLM_PROVIDERS = [
  { value: 'claude',   label: 'Claude (Anthropic)' },
  { value: 'openai',   label: 'ChatGPT (OpenAI)' },
  { value: 'azure',    label: 'Azure OpenAI (GitHub Copilot)' },
  { value: 'simulate', label: 'Simulation (no API key needed)' },
];

const roleColors: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  BA_AGENT:       'info',
  DEV_AGENT:      'success',
  QA_AGENT:       'warning',
  DEVOPS_AGENT:   'danger',
  DESIGNER_AGENT: 'neutral',
  SRE_AGENT:      'neutral',
};

const providerBadge: Record<string, 'info' | 'success' | 'warning' | 'neutral'> = {
  claude:   'info',
  openai:   'success',
  azure:    'warning',
  simulate: 'neutral',
};

const EMPTY: CreateAgentProfilePayload = {
  name: '', role: 'DEV_AGENT', skillSet: [], supportedPhases: [],
  config: { provider: 'claude', model: '', systemPrompt: '' },
};

export function AgentsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const {
    data: profiles, loading, refetch,
  } = useQuery(() => agentsService.listProfiles(projectId!), [projectId]);
  const { data: phases } = useQuery(() => workflowService.listPhases(projectId!), [projectId]);
  const { data: llmInfo } = useQuery(() => agentsService.getLlmProviders(projectId!), [projectId]);

  const [modalOpen, setModalOpen]   = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [form, setForm]             = useState<CreateAgentProfilePayload>(EMPTY);
  const [skillInput, setSkillInput] = useState('');
  const [phaseInput, setPhaseInput] = useState('');
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState('');
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [seeding, setSeeding]       = useState(false);

  const [mappingProfileId, setMappingProfileId] = useState('');
  const [mappingPhaseId,   setMappingPhaseId]   = useState('');
  const [mapSaving,        setMapSaving]         = useState(false);
  const {
    data: mappings, refetch: refetchMappings,
  } = useQuery(() => agentsService.listMappings(projectId!), [projectId]);

  async function handleSeed() {
    setSeeding(true);
    try { await agentsService.seedDefaults(projectId!); refetch(); }
    finally { setSeeding(false); }
  }

  function openCreate() {
    setEditingId(null); setForm(EMPTY); setSkillInput(''); setPhaseInput(''); setFormError(''); setModalOpen(true);
  }

  function openEdit(p: AgentProfile) {
    setEditingId(p.id);
    const cfg = (p.config ?? {}) as { provider?: string; model?: string; systemPrompt?: string };
    setForm({ name: p.name, role: p.role, description: p.description, skillSet: p.skillSet, supportedPhases: p.supportedPhases,
      config: { provider: cfg.provider ?? 'claude', model: cfg.model ?? '', systemPrompt: cfg.systemPrompt ?? '' } });
    setSkillInput(p.skillSet.join(', ')); setPhaseInput(p.supportedPhases.join(', ')); setFormError(''); setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setFormError('');
    const payload: CreateAgentProfilePayload = {
      ...form,
      skillSet:        skillInput.split(',').map((s) => s.trim()).filter(Boolean),
      supportedPhases: phaseInput.split(',').map((s) => s.trim()).filter(Boolean),
    };
    try {
      if (editingId) { await agentsService.updateProfile(projectId!, editingId, payload); }
      else           { await agentsService.createProfile(projectId!, payload); }
      setModalOpen(false); refetch();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed to save'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    await agentsService.deleteProfile(projectId!, deleteId); setDeleteId(null); refetch();
  }

  async function addMapping(e: React.FormEvent) {
    e.preventDefault(); if (!mappingProfileId || !mappingPhaseId) return; setMapSaving(true);
    try {
      await agentsService.createMapping(projectId!, { phaseId: mappingPhaseId, agentProfileId: mappingProfileId });
      setMappingProfileId(''); setMappingPhaseId(''); refetchMappings();
    } finally { setMapSaving(false); }
  }

  const phaseOptions   = (phases   ?? []).map((p) => ({ value: p.id, label: p.name }));
  const profileOptions = (profiles ?? []).map((p) => ({ value: p.id, label: `${p.name} (${p.role})` }));
  const formConfig = (form.config ?? {}) as { provider?: string; model?: string; systemPrompt?: string };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Agent Profiles"
        description="Define AI agents and map them to SDLC phases for automated workflow execution."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleSeed} loading={seeding}>Seed defaults</Button>
            <Button size="sm" onClick={openCreate}>+ New Profile</Button>
          </div>
        }
      />

      {/* LLM provider status banner */}
      {llmInfo && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-bg-surface border border-border-subtle text-sm">
          <span className="text-text-secondary">LLM providers:</span>
          <div className="flex gap-2 flex-wrap">
            {llmInfo.available.map((p) => (
              <Badge key={p} variant={providerBadge[p] ?? 'neutral'}>{p === llmInfo.default ? `${p} ★` : p}</Badge>
            ))}
          </div>
          {llmInfo.available.includes('simulate') && llmInfo.available.length === 1 && (
            <span className="text-text-disabled text-xs ml-auto">Set ANTHROPIC_API_KEY or OPENAI_API_KEY to enable real LLM calls</span>
          )}
        </div>
      )}

      {/* Profiles table */}
      {!loading && !profiles?.length ? (
        <EmptyState title="No agent profiles yet" description="Seed default profiles (BA, Dev, QA, DevOps) or create your own."
          action={<Button size="sm" onClick={handleSeed} loading={seeding}>Seed defaults</Button>} />
      ) : (
        <Table loading={loading} rows={profiles ?? []} columns={[
          { key: 'name', header: 'Name', render: (r) => <span className="font-medium text-text-primary">{r.name}</span> },
          { key: 'role', header: 'Role', width: '140px', render: (r) => (
            <Badge variant={roleColors[r.role] ?? 'neutral'}>{r.role.replace('_AGENT', '')}</Badge>
          )},
          { key: 'provider', header: 'LLM', width: '90px', render: (r) => {
            const cfg = (r.config ?? {}) as { provider?: string };
            const p = cfg.provider ?? llmInfo?.default ?? 'simulate';
            return <Badge variant={providerBadge[p] ?? 'neutral'}>{p}</Badge>;
          }},
          { key: 'skills', header: 'Skills', render: (r) => (
            <div className="flex gap-1 flex-wrap">
              {r.skillSet.slice(0, 3).map((s) => <Badge key={s} variant="default" className="text-[10px]">{s}</Badge>)}
              {r.skillSet.length > 3 && <Badge variant="default" className="text-[10px]">+{r.skillSet.length - 3}</Badge>}
            </div>
          )},
          { key: 'phases', header: 'Phases', width: '120px', render: (r) => (
            <span className="text-xs text-text-secondary">{r.supportedPhases.join(', ') || '—'}</span>
          )},
          { key: 'mappings', header: 'Mappings', width: '90px', render: (r) => (
            <span className="tabular-nums text-text-secondary">{r._count?.phaseMappings ?? 0}</span>
          )},
          { key: 'type', header: 'Type', width: '80px', render: (r) => (
            <Badge variant={r.isDefault ? 'info' : 'neutral'}>{r.isDefault ? 'Default' : 'Custom'}</Badge>
          )},
          { key: 'actions', header: '', width: '80px', render: (r) => (
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>Edit</Button>
              {!r.isDefault && <Button size="sm" variant="danger" onClick={() => setDeleteId(r.id)}>✕</Button>}
            </div>
          )},
        ]} />
      )}

      {/* Phase-to-Agent Mappings */}
      <div>
        <h2 className="text-[13px] font-medium text-text-secondary uppercase tracking-wide mb-3">Phase → Agent Mappings</h2>
        <form onSubmit={addMapping} className="flex items-end gap-3 mb-4 flex-wrap">
          <Select label="Workflow phase" value={mappingPhaseId} options={phaseOptions} placeholder="Select phase…"
            onChange={(e) => setMappingPhaseId(e.target.value)} className="w-48" />
          <Select label="Agent profile" value={mappingProfileId} options={profileOptions} placeholder="Select agent…"
            onChange={(e) => setMappingProfileId(e.target.value)} className="w-56" />
          <Button type="submit" size="sm" loading={mapSaving} disabled={!mappingPhaseId || !mappingProfileId}>Add mapping</Button>
        </form>

        <div className="rounded-xl bg-bg-surface border border-border-subtle overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default">
                {['Phase','Agent','Role','LLM',''].map((h, i) => (
                  <th key={i} className="text-left px-4 h-10 text-[11px] uppercase tracking-wide text-text-secondary font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!(mappings?.length) ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-text-secondary">No mappings yet — add one above.</td></tr>
              ) : mappings.map((m) => {
                const phaseName = phases?.find((p) => p.id === m.phaseId)?.name ?? m.phaseId;
                const cfg = (m.agentProfile as any).config as { provider?: string } | undefined;
                const provider = cfg?.provider ?? llmInfo?.default ?? 'simulate';
                return (
                  <tr key={m.id} className="border-b border-border-subtle last:border-0">
                    <td className="px-4 h-10 text-sm text-text-primary">{phaseName}</td>
                    <td className="px-4 h-10 text-sm font-medium text-text-primary">{m.agentProfile.name}</td>
                    <td className="px-4 h-10"><Badge variant={roleColors[m.agentProfile.role] ?? 'neutral'}>{m.agentProfile.role.replace('_AGENT', '')}</Badge></td>
                    <td className="px-4 h-10"><Badge variant={providerBadge[provider] ?? 'neutral'}>{provider}</Badge></td>
                    <td className="px-4 h-10">
                      <Button size="sm" variant="danger" onClick={() => agentsService.deleteMapping(projectId!, m.id).then(refetchMappings)}>✕</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Agent Profile' : 'New Agent Profile'} size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button form="agent-form" type="submit" loading={saving}>{editingId ? 'Save' : 'Create'}</Button>
          </>
        }
      >
        {formError && (
          <div className="mb-4 text-sm text-status-danger bg-[rgba(239,68,68,0.1)] px-3 py-2 rounded-md">{formError}</div>
        )}
        <form id="agent-form" onSubmit={handleSave} className="space-y-4">
          <Input label="Agent name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Select label="Role" value={form.role} options={ROLES} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          <TextArea label="Description" rows={2} value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label="Skill set (comma separated)" value={skillInput} onChange={(e) => setSkillInput(e.target.value)} placeholder="e.g. code-generation, unit-testing" />
          <Input label="Supported phases (comma separated)" value={phaseInput} onChange={(e) => setPhaseInput(e.target.value)} placeholder="e.g. In Dev, In Review" />

          <div className="pt-2 border-t border-border-subtle">
            <p className="text-[11px] uppercase tracking-wide text-text-disabled font-medium mb-3">LLM Configuration</p>
            <div className="space-y-3">
              <Select label="LLM Provider" value={formConfig.provider ?? 'claude'} options={LLM_PROVIDERS}
                onChange={(e) => setForm({ ...form, config: { ...formConfig, provider: e.target.value } })} />
              <Input label="Model override (optional)" value={formConfig.model ?? ''}
                onChange={(e) => setForm({ ...form, config: { ...formConfig, model: e.target.value } })}
                placeholder={
                  formConfig.provider === 'claude' ? 'e.g. claude-opus-4-5' :
                  formConfig.provider === 'openai' ? 'e.g. gpt-4o, o1' :
                  formConfig.provider === 'azure'  ? 'e.g. gpt-4o' : 'leave blank for default'
                } />
              <TextArea label="Custom system prompt (optional)" rows={3} value={formConfig.systemPrompt ?? ''}
                onChange={(e) => setForm({ ...form, config: { ...formConfig, systemPrompt: e.target.value } })}
                placeholder="Override the default role-based system prompt…" />
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Delete Agent Profile" message="This agent profile and all its phase mappings will be deleted." />
    </div>
  );
}
