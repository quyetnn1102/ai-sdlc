import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@/lib/hooks';
import {
  testsService,
  type TestCase,
  type CreateTestCasePayload,
  type TestPriority,
  type TestType,
} from '@/services/tests.service';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table } from '@/components/ui/Table';
import { Badge, statusToVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StaticTabs } from '@/components/ui/Tabs';
import { ApiError } from '@/lib/api';

const PRIORITIES = [
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH',     label: 'High' },
  { value: 'MEDIUM',   label: 'Medium' },
  { value: 'LOW',      label: 'Low' },
];
const TYPES = [
  { value: 'MANUAL',      label: 'Manual' },
  { value: 'UNIT',        label: 'Unit' },
  { value: 'INTEGRATION', label: 'Integration' },
  { value: 'E2E',         label: 'E2E' },
  { value: 'PERFORMANCE', label: 'Performance' },
  { value: 'SECURITY',    label: 'Security' },
];

const priVariant: Record<TestPriority, 'danger' | 'warning' | 'pending' | 'neutral'> = {
  CRITICAL: 'danger', HIGH: 'warning', MEDIUM: 'pending', LOW: 'neutral',
};

const EMPTY: CreateTestCasePayload = {
  title: '', priority: 'MEDIUM', type: 'MANUAL',
};

export function TestsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [tab, setTab] = useState('cases');

  const { data: cases, loading: casesLoading, refetch: refetchCases } = useQuery(
    () => testsService.listCases(projectId!), [projectId],
  );
  const { data: coverage } = useQuery(
    () => testsService.coverage(projectId!), [projectId],
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateTestCasePayload>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(tc: TestCase) {
    setEditingId(tc.id);
    setForm({
      title: tc.title,
      description: tc.description ?? '',
      preconditions: tc.preconditions ?? '',
      expectedResult: tc.expectedResult ?? '',
      priority: tc.priority,
      type: tc.type,
      linkedRequirementId: tc.linkedRequirementId ?? '',
    });
    setFormError('');
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (editingId) {
        await testsService.updateCase(projectId!, editingId, form);
      } else {
        await testsService.createCase(projectId!, form);
      }
      setModalOpen(false);
      refetchCases();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to save');
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    await testsService.deleteCase(projectId!, deleteId);
    setDeleteId(null);
    refetchCases();
  }

  return (
    <div>
      <PageHeader title="Test Cases" actions={<Button onClick={openCreate}>+ New Test Case</Button>} />

      <StaticTabs
        tabs={[
          { key: 'cases', label: `Test Cases (${cases?.length ?? 0})` },
          { key: 'coverage', label: 'Coverage by Requirement' },
        ]}
        active={tab}
        onChange={setTab}
        className="mb-5"
      />

      {tab === 'cases' && (
        <Table
          loading={casesLoading}
          rows={cases ?? []}
          emptyMessage="No test cases yet"
          columns={[
            { key: 'title', header: 'Title', render: (r) => (
              <span className="font-medium text-text-primary">{r.title}</span>
            )},
            { key: 'type', header: 'Type', width: '120px', render: (r) => (
              <Badge variant="default">{r.type}</Badge>
            )},
            { key: 'priority', header: 'Priority', width: '100px', render: (r) => (
              <Badge variant={priVariant[r.priority]}>{r.priority}</Badge>
            )},
            { key: 'req', header: 'Requirement', width: '120px', render: (r) => (
              <span className="text-xs font-mono text-text-secondary">{r.linkedRequirementId ?? '—'}</span>
            )},
            { key: 'lastRun', header: 'Last Run', width: '100px', render: (r) => {
              const result = r.testRuns?.[0]?.result;
              return result
                ? <Badge variant={statusToVariant(result)}>{result}</Badge>
                : <span className="text-xs text-text-disabled">—</span>;
            }},
            { key: 'actions', header: '', width: '100px', render: (r) => (
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>Edit</Button>
                <Button size="sm" variant="danger" onClick={() => setDeleteId(r.id)}>✕</Button>
              </div>
            )},
          ]}
        />
      )}

      {tab === 'coverage' && (
        <div className="rounded-xl bg-bg-surface border border-border-subtle overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default">
                <th className="text-left px-4 h-10 text-[11px] uppercase tracking-wide text-text-secondary font-medium">Requirement</th>
                <th className="text-left px-4 h-10 text-[11px] uppercase tracking-wide text-text-secondary font-medium">Test Cases</th>
                <th className="text-left px-4 h-10 text-[11px] uppercase tracking-wide text-text-secondary font-medium">Passed</th>
                <th className="text-left px-4 h-10 text-[11px] uppercase tracking-wide text-text-secondary font-medium">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {!(coverage?.length) ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-text-secondary">No coverage data yet</td></tr>
              ) : coverage.map((row) => (
                <tr key={row.requirementId} className="border-b border-border-subtle last:border-0">
                  <td className="px-4 h-10 text-sm font-mono text-text-secondary">{row.requirementId}</td>
                  <td className="px-4 h-10 text-sm tabular-nums text-text-primary">{row.total}</td>
                  <td className="px-4 h-10 text-sm tabular-nums text-text-primary">{row.passed}</td>
                  <td className="px-4 h-10">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-bg-elevated overflow-hidden">
                        <div className="h-full rounded-full bg-status-success"
                          style={{ width: `${row.coverage}%` }} />
                      </div>
                      <span className="text-sm tabular-nums text-text-primary w-9 text-right">{row.coverage}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Test Case' : 'New Test Case'} size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button form="test-case-form" type="submit" loading={saving}>
              {editingId ? 'Save' : 'Create'}
            </Button>
          </>
        }
      >
        {formError && <div className="mb-4 text-sm text-status-danger bg-[rgba(239,68,68,0.1)] px-3 py-2 rounded-md">{formError}</div>}
        <form id="test-case-form" onSubmit={handleSave} className="space-y-4">
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <TextArea label="Description" rows={2} value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <TextArea label="Preconditions" rows={2} value={form.preconditions ?? ''}
            onChange={(e) => setForm({ ...form, preconditions: e.target.value })} />
          <TextArea label="Expected Result" rows={2} value={form.expectedResult ?? ''}
            onChange={(e) => setForm({ ...form, expectedResult: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Priority" value={form.priority ?? 'MEDIUM'} options={PRIORITIES}
              onChange={(e) => setForm({ ...form, priority: e.target.value as TestPriority })} />
            <Select label="Type" value={form.type ?? 'MANUAL'} options={TYPES}
              onChange={(e) => setForm({ ...form, type: e.target.value as TestType })} />
          </div>
          <Input label="Linked Requirement (Jira key)" value={form.linkedRequirementId ?? ''}
            placeholder="e.g. PROJ-42"
            onChange={(e) => setForm({ ...form, linkedRequirementId: e.target.value })} />
        </form>
      </Modal>

      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Delete Test Case" message="This test case and all its run history will be deleted." />
    </div>
  );
}
