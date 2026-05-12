import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@/lib/hooks';
import { gatesService, type CreateGatePayload } from '@/services/gates.service';
import { workflowService } from '@/services/workflow.service';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table } from '@/components/ui/Table';
import { Badge, statusToVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ApiError } from '@/lib/api';

const RULE_TYPES = [
  { value: 'MIN_COVERAGE', label: 'Min Coverage %' },
  { value: 'MAX_CRITICAL_ISSUES', label: 'Max Critical Issues' },
  { value: 'CI_CHECK_PASS', label: 'CI Check Must Pass' },
];
const ENFORCEMENT = [
  { value: 'ADVISORY', label: 'Advisory (warn only)' },
  { value: 'BLOCKING', label: 'Blocking (hard stop)' },
];

export function GatesPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { t } = useTranslation();

  const { data: gateStatus, loading, refetch } = useQuery(
    () => gatesService.status(projectId!), [projectId],
  );
  const { data: phases } = useQuery(() => workflowService.listPhases(projectId!), [projectId]);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<Omit<CreateGatePayload, 'ruleConfig'> & { threshold?: string; maxIssues?: string; checkName?: string }>({
    name: '', workflowPhaseId: '', ruleType: 'MIN_COVERAGE', enforcement: 'ADVISORY',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  function buildRuleConfig(): Record<string, unknown> {
    switch (form.ruleType) {
      case 'MIN_COVERAGE':    return { threshold: Number(form.threshold ?? 80) };
      case 'MAX_CRITICAL_ISSUES': return { max: Number(form.maxIssues ?? 0), severity: 'critical' };
      case 'CI_CHECK_PASS':   return { checkName: form.checkName ?? '' };
      default: return {};
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await gatesService.create(projectId!, { ...form, ruleConfig: buildRuleConfig() } as CreateGatePayload);
      setAddOpen(false);
      refetch();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed');
    } finally { setSaving(false); }
  }

  const phaseOptions = (phases ?? []).map((p) => ({ value: p.id, label: p.name }));

  return (
    <div>
      <PageHeader
        title={t('projects.gates')}
        actions={<Button size="sm" onClick={() => setAddOpen(true)}>+ Add gate</Button>}
      />

      <Table
        loading={loading}
        rows={gateStatus ?? []}
        emptyMessage="No quality gates defined"
        columns={[
          { key: 'phase', header: 'Phase', render: (r) => <span className="text-text-secondary">{r.phase}</span> },
          { key: 'name', header: 'Gate', render: (r) => <span className="font-medium">{r.name}</span> },
          { key: 'rule', header: 'Rule Type', width: '180px', render: (r) => (
            <span className="text-xs text-text-secondary">{r.ruleType.replace(/_/g, ' ')}</span>
          )},
          { key: 'enforcement', header: 'Mode', width: '100px', render: (r) => (
            <Badge variant={r.enforcement === 'BLOCKING' ? 'danger' : 'pending'}>{r.enforcement}</Badge>
          )},
          { key: 'status', header: 'Status', width: '100px', render: (r) => (
            <Badge variant={statusToVariant(r.latestStatus)}>{r.latestStatus}</Badge>
          )},
          { key: 'last', header: 'Last Evaluated', width: '160px', render: (r) => (
            <span className="text-xs text-text-secondary">
              {r.lastEvaluated ? new Date(r.lastEvaluated).toLocaleString() : '—'}
            </span>
          )},
        ]}
      />

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add quality gate" size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" form="add-gate-form" type="submit" loading={saving}>Add Gate</Button>
          </>
        }
      >
        {formError && <div className="mb-4 text-sm text-status-danger bg-[rgba(239,68,68,0.1)] px-3 py-2 rounded-md">{formError}</div>}
        <form id="add-gate-form" onSubmit={handleAdd} className="space-y-4">
          <Input label="Gate name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Select label="Workflow phase" value={form.workflowPhaseId} placeholder="Select phase…"
            options={phaseOptions} onChange={(e) => setForm({ ...form, workflowPhaseId: e.target.value })} />
          <Select label="Rule type" value={form.ruleType} options={RULE_TYPES}
            onChange={(e) => setForm({ ...form, ruleType: e.target.value as CreateGatePayload['ruleType'] })} />
          {form.ruleType === 'MIN_COVERAGE' && (
            <Input label="Minimum coverage %" type="number" placeholder="80"
              value={form.threshold ?? ''} onChange={(e) => setForm({ ...form, threshold: e.target.value })} />
          )}
          {form.ruleType === 'MAX_CRITICAL_ISSUES' && (
            <Input label="Max allowed critical issues" type="number" placeholder="0"
              value={form.maxIssues ?? ''} onChange={(e) => setForm({ ...form, maxIssues: e.target.value })} />
          )}
          {form.ruleType === 'CI_CHECK_PASS' && (
            <Input label="CI check name" placeholder="e.g. integration-tests"
              value={form.checkName ?? ''} onChange={(e) => setForm({ ...form, checkName: e.target.value })} />
          )}
          <Select label="Enforcement" value={form.enforcement ?? 'ADVISORY'} options={ENFORCEMENT}
            onChange={(e) => setForm({ ...form, enforcement: e.target.value as 'ADVISORY' | 'BLOCKING' })} />
        </form>
      </Modal>
    </div>
  );
}
