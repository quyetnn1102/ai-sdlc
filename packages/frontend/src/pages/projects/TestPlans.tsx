import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@/lib/hooks';
import {
  testsService,
  type TestPlan,
  type CreateTestPlanPayload,
  type TestResult,
} from '@/services/tests.service';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table } from '@/components/ui/Table';
import { Badge, statusToVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ApiError } from '@/lib/api';

const RESULTS: Array<{ value: TestResult; label: string }> = [
  { value: 'PASS', label: 'Pass' },
  { value: 'FAIL', label: 'Fail' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'SKIP', label: 'Skip' },
];

export function TestPlansPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { data: plans, loading, refetch } = useQuery(
    () => testsService.listPlans(projectId!), [projectId],
  );
  const { data: allCases } = useQuery(
    () => testsService.listCases(projectId!), [projectId],
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateTestPlanPayload>({ name: '', testCaseIds: [] });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Run result tracking per plan detail view
  const [detailPlan, setDetailPlan] = useState<TestPlan | null>(null);
  const [runResult, setRunResult] = useState<Record<string, TestResult>>({});

  function openCreate() {
    setEditingId(null);
    setForm({ name: '', testCaseIds: [] });
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(plan: TestPlan) {
    setEditingId(plan.id);
    setForm({ name: plan.name, description: plan.description, sprintName: plan.sprintName, testCaseIds: plan.testCaseIds });
    setFormError('');
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (editingId) {
        await testsService.updatePlan(projectId!, editingId, form);
      } else {
        await testsService.createPlan(projectId!, form);
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to save');
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    await testsService.deletePlan(projectId!, deleteId);
    setDeleteId(null);
    refetch();
  }

  function toggleCase(caseId: string) {
    const ids = form.testCaseIds ?? [];
    setForm({
      ...form,
      testCaseIds: ids.includes(caseId) ? ids.filter((id) => id !== caseId) : [...ids, caseId],
    });
  }

  async function recordRun(caseId: string) {
    const result = runResult[caseId];
    if (!result || !detailPlan) return;
    await testsService.createRun(projectId!, { testCaseId: caseId, testPlanId: detailPlan.id, result });
  }

  return (
    <div>
      <PageHeader title="Test Plans" actions={<Button onClick={openCreate}>+ New Plan</Button>} />

      <Table
        loading={loading}
        rows={plans ?? []}
        emptyMessage="No test plans yet"
        onRowClick={(r) => setDetailPlan(r)}
        columns={[
          { key: 'name', header: 'Plan', render: (r) => (
            <span className="font-medium text-text-primary">{r.name}</span>
          )},
          { key: 'sprint', header: 'Sprint', width: '140px', render: (r) => (
            <span className="text-xs text-text-secondary">{r.sprintName ?? '—'}</span>
          )},
          { key: 'cases', header: 'Test Cases', width: '100px', render: (r) => (
            <span className="tabular-nums text-text-secondary">{r.testCaseIds.length}</span>
          )},
          { key: 'status', header: 'Status', width: '100px', render: (r) => (
            <Badge variant={statusToVariant(r.status)}>{r.status}</Badge>
          )},
          { key: 'actions', header: '', width: '100px', render: (r) => (
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>Edit</Button>
              <Button size="sm" variant="danger" onClick={() => setDeleteId(r.id)}>✕</Button>
            </div>
          )},
        ]}
      />

      {/* Plan detail with run recording */}
      <Modal open={!!detailPlan} onClose={() => setDetailPlan(null)}
        title={detailPlan?.name ?? 'Plan Detail'} size="lg"
        footer={<Button variant="secondary" onClick={() => setDetailPlan(null)}>Close</Button>}
      >
        {detailPlan && (
          <div className="space-y-2">
            {detailPlan.testCaseIds.map((caseId) => {
              const tc = allCases?.find((c) => c.id === caseId);
              if (!tc) return null;
              const latest = tc.testRuns?.[0];
              return (
                <div key={caseId} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-bg-elevated">
                  <span className="flex-1 text-sm text-text-primary">{tc.title}</span>
                  {latest && (
                    <Badge variant={statusToVariant(latest.result)} className="text-xs">{latest.result}</Badge>
                  )}
                  <Select
                    value={runResult[caseId] ?? ''}
                    placeholder="Record result…"
                    options={RESULTS}
                    onChange={(e) => setRunResult({ ...runResult, [caseId]: e.target.value as TestResult })}
                    className="w-36"
                  />
                  <Button size="sm" variant="secondary"
                    onClick={() => recordRun(caseId)}
                    disabled={!runResult[caseId]}>
                    Save
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* Create / Edit */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Test Plan' : 'New Test Plan'} size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button form="test-plan-form" type="submit" loading={saving}>
              {editingId ? 'Save' : 'Create'}
            </Button>
          </>
        }
      >
        {formError && <div className="mb-4 text-sm text-status-danger bg-[rgba(239,68,68,0.1)] px-3 py-2 rounded-md">{formError}</div>}
        <form id="test-plan-form" onSubmit={handleSave} className="space-y-4">
          <Input label="Plan name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Sprint / Release" value={form.sprintName ?? ''}
            onChange={(e) => setForm({ ...form, sprintName: e.target.value })} placeholder="e.g. Sprint 24" />
          <div>
            <label className="text-xs text-text-secondary mb-1.5 block">
              Test Cases ({form.testCaseIds?.length ?? 0} selected)
            </label>
            <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border border-border-default p-2">
              {(allCases ?? []).map((tc) => (
                <label key={tc.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-bg-hover cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.testCaseIds?.includes(tc.id) ?? false}
                    onChange={() => toggleCase(tc.id)}
                    className="accent-accent-primary"
                  />
                  <span className="text-sm text-text-primary">{tc.title}</span>
                  <Badge variant="default" className="ml-auto">{tc.priority}</Badge>
                </label>
              ))}
              {!allCases?.length && (
                <p className="text-xs text-text-secondary px-2 py-2">No test cases yet — create some first.</p>
              )}
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Delete Test Plan" message="This test plan will be deleted. Test runs are not affected." />
    </div>
  );
}
