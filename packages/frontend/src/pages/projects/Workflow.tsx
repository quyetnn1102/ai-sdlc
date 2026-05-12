import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@/lib/hooks';
import { workflowService, type WorkflowPhase, type CreatePhasePayload } from '@/services/workflow.service';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { ApiError } from '@/lib/api';

const PHASE_COLORS = [
  '#6B7280','#3B82F6','#4F6EF7','#8B5CF6','#F59E0B','#22C55E','#10B981','#EF4444',
];

const MAPPING_SOURCES = [
  { value: 'JIRA', label: 'Jira' },
  { value: 'GITHUB', label: 'GitHub' },
  { value: 'GITLAB', label: 'GitLab' },
];

function PhaseCard({ phase, projectId, onRefetch }: { phase: WorkflowPhase; projectId: string; onRefetch: () => void }) {
  const [mappingOpen, setMappingOpen] = useState(false);
  const [mapStatus, setMapStatus] = useState('');
  const [mapSource, setMapSource] = useState('JIRA');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function addMapping() {
    if (!mapStatus.trim()) return;
    setSaving(true);
    try {
      await workflowService.addMapping(projectId, phase.id, { externalStatus: mapStatus, source: mapSource });
      setMapStatus('');
      setMappingOpen(false);
      onRefetch();
    } finally { setSaving(false); }
  }

  async function removeMapping(mappingId: string) {
    await workflowService.removeMapping(projectId, phase.id, mappingId);
    setDeleteId(null);
    onRefetch();
  }

  return (
    <div className="p-4 rounded-xl bg-bg-surface border border-border-subtle">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: phase.color }} />
        <span className="text-sm font-medium text-text-primary flex-1">{phase.name}</span>
        <span className="text-[11px] text-text-disabled bg-bg-elevated px-2 py-0.5 rounded">#{phase.order}</span>
      </div>

      {/* Status mappings */}
      <div className="space-y-1 mb-2">
        {phase.statusMappings.map((m) => (
          <div key={m.id} className="flex items-center justify-between px-2 py-1 rounded bg-bg-elevated">
            <span className="text-xs text-text-secondary">
              <span className="text-text-disabled">{m.source}:</span> {m.externalStatus}
            </span>
            <button
              onClick={() => setDeleteId(m.id)}
              className="text-[10px] text-text-disabled hover:text-status-danger transition-colors ml-2"
            >✕</button>
          </div>
        ))}
        {phase.statusMappings.length === 0 && (
          <p className="text-[11px] text-text-disabled px-2">No status mappings</p>
        )}
      </div>

      <Button size="sm" variant="ghost" onClick={() => setMappingOpen(true)}>
        + Add mapping
      </Button>

      {/* Add mapping modal */}
      <Modal open={mappingOpen} onClose={() => setMappingOpen(false)}
        title={`Map status → ${phase.name}`} size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setMappingOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={addMapping} loading={saving}>Add</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Select label="Source" value={mapSource} onChange={(e) => setMapSource(e.target.value)} options={MAPPING_SOURCES} />
          <Input label="External status name" value={mapStatus}
            onChange={(e) => setMapStatus(e.target.value)} placeholder="e.g. In Progress" />
        </div>
      </Modal>

      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && removeMapping(deleteId)}
        title="Remove mapping" message="Remove this status mapping?" />
    </div>
  );
}

export function WorkflowPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { data: phases, loading, refetch } = useQuery(
    () => workflowService.listPhases(projectId!), [projectId],
  );

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<CreatePhasePayload>({ name: '', order: (phases?.length ?? 0) + 1, color: '#6B7280' });
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await workflowService.createPhase(projectId!, { ...form, order: (phases?.length ?? 0) + 1 });
      setAddOpen(false);
      setForm({ name: '', order: 1, color: '#6B7280' });
      refetch();
    } finally { setSaving(false); }
  }

  return (
    <div>
      <PageHeader
        title={t('projects.workflow')}
        actions={<Button size="sm" onClick={() => setAddOpen(true)}>+ Add phase</Button>}
      />

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => <div key={i} className="h-24 rounded-xl bg-bg-surface border border-border-subtle animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {(phases ?? []).map((phase) => (
            <PhaseCard key={phase.id} phase={phase} projectId={projectId!} onRefetch={refetch} />
          ))}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add workflow phase" size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" form="add-phase-form" type="submit" loading={saving}>Add</Button>
          </>
        }
      >
        <form id="add-phase-form" onSubmit={handleAdd} className="space-y-4">
          <Input label="Phase name" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <div>
            <label className="text-xs text-text-secondary mb-1.5 block">Color</label>
            <div className="flex gap-2 flex-wrap">
              {PHASE_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                  className="w-6 h-6 rounded-full border-2 transition-all"
                  style={{ backgroundColor: c, borderColor: form.color === c ? 'white' : 'transparent' }}
                />
              ))}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
