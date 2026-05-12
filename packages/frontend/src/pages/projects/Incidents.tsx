import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@/lib/hooks';
import {
  incidentsService,
  type Incident,
  type CreateIncidentPayload,
  type Severity,
} from '@/services/incidents.service';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table } from '@/components/ui/Table';
import { Badge, statusToVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { MetricCard } from '@/components/ui/Card';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { ApiError } from '@/lib/api';

const SEVERITIES: Array<{ value: Severity; label: string }> = [
  { value: 'P1', label: 'P1 – Critical' },
  { value: 'P2', label: 'P2 – Major' },
  { value: 'P3', label: 'P3 – Minor' },
  { value: 'P4', label: 'P4 – Low' },
];

const sevVariant: Record<Severity, 'danger' | 'warning' | 'pending' | 'neutral'> = {
  P1: 'danger', P2: 'warning', P3: 'pending', P4: 'neutral',
};

const EMPTY: CreateIncidentPayload = { title: '', severity: 'P2' };

export function IncidentsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { data: incidents, loading, refetch } = useQuery(
    () => incidentsService.list(projectId!), [projectId],
  );
  const { data: stats, loading: statsLoading } = useQuery(
    () => incidentsService.stats(projectId!), [projectId],
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateIncidentPayload>(EMPTY);
  const [timelineNote, setTimelineNote] = useState('');
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const detailIncident = incidents?.find((i) => i.id === detailId) ?? null;

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(inc: Incident) {
    setEditingId(inc.id);
    setForm({
      title: inc.title,
      severity: inc.severity,
      startAt: inc.startAt ?? '',
      endAt: inc.endAt ?? '',
      affectedService: inc.affectedService ?? '',
      rootCauseNotes: inc.rootCauseNotes ?? '',
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
        await incidentsService.update(projectId!, editingId, form);
      } else {
        await incidentsService.create(projectId!, form);
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to save');
    } finally { setSaving(false); }
  }

  async function handleResolve() {
    if (!resolveId) return;
    await incidentsService.resolve(projectId!, resolveId);
    setResolveId(null);
    refetch();
  }

  async function handleDelete() {
    if (!deleteId) return;
    await incidentsService.delete(projectId!, deleteId);
    setDeleteId(null);
    refetch();
  }

  async function addTimeline() {
    if (!detailId || !timelineNote.trim()) return;
    await incidentsService.addTimeline(projectId!, detailId, timelineNote.trim());
    setTimelineNote('');
    refetch();
  }

  return (
    <div>
      <PageHeader title="Incidents" actions={<Button onClick={openCreate}>+ New Incident</Button>} />

      {/* Stats strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statsLoading ? [1,2,3,4].map((i) => <SkeletonCard key={i} />) : (
          <>
            <MetricCard label="Total" value={stats?.total ?? null} />
            <MetricCard label="Open" value={stats?.open ?? null} />
            <MetricCard label="MTTR avg" value={stats?.mttr.avgMinutes ?? null} suffix="min" />
            <MetricCard label="Change Failure Rate" value={stats?.changeFailureRate.rate ?? null} suffix="%" />
          </>
        )}
      </div>

      {/* Table */}
      <Table
        loading={loading}
        rows={incidents ?? []}
        emptyMessage="No incidents recorded"
        onRowClick={(r) => setDetailId(r.id)}
        columns={[
          { key: 'sev', header: 'Sev', width: '60px', render: (r) => (
            <Badge variant={sevVariant[r.severity]}>{r.severity}</Badge>
          )},
          { key: 'title', header: 'Title', render: (r) => (
            <span className="font-medium text-text-primary">{r.title}</span>
          )},
          { key: 'status', header: 'Status', width: '120px', render: (r) => (
            <Badge variant={statusToVariant(r.status)}>{r.status}</Badge>
          )},
          { key: 'service', header: 'Service', width: '140px', render: (r) => (
            <span className="text-xs text-text-secondary">{r.affectedService ?? '—'}</span>
          )},
          { key: 'started', header: 'Started', width: '160px', render: (r) => (
            <span className="text-xs text-text-secondary">
              {r.startAt ? new Date(r.startAt).toLocaleString() : '—'}
            </span>
          )},
          { key: 'actions', header: '', width: '140px', render: (r) => (
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              {r.status !== 'RESOLVED' && r.status !== 'CLOSED' && (
                <Button size="sm" variant="secondary" onClick={() => setResolveId(r.id)}>Resolve</Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>Edit</Button>
              <Button size="sm" variant="danger" onClick={() => setDeleteId(r.id)}>✕</Button>
            </div>
          )},
        ]}
      />

      {/* Create / Edit */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Incident' : 'New Incident'} size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button form="incident-form" type="submit" loading={saving}>
              {editingId ? 'Save' : 'Create'}
            </Button>
          </>
        }
      >
        {formError && <div className="mb-4 text-sm text-status-danger bg-[rgba(239,68,68,0.1)] px-3 py-2 rounded-md">{formError}</div>}
        <form id="incident-form" onSubmit={handleSave} className="space-y-4">
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <Select label="Severity" value={form.severity} options={SEVERITIES}
            onChange={(e) => setForm({ ...form, severity: e.target.value as Severity })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start time" type="datetime-local" value={form.startAt ?? ''}
              onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
            <Input label="End time" type="datetime-local" value={form.endAt ?? ''}
              onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
          </div>
          <Input label="Affected service" value={form.affectedService ?? ''}
            onChange={(e) => setForm({ ...form, affectedService: e.target.value })} />
          <TextArea label="Root cause notes" rows={3} value={form.rootCauseNotes ?? ''}
            onChange={(e) => setForm({ ...form, rootCauseNotes: e.target.value })} />
        </form>
      </Modal>

      {/* Detail / Timeline */}
      <Modal open={!!detailId} onClose={() => setDetailId(null)}
        title={detailIncident?.title ?? 'Incident Detail'} size="lg"
        footer={<Button variant="secondary" onClick={() => setDetailId(null)}>Close</Button>}
      >
        {detailIncident && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant={sevVariant[detailIncident.severity]}>{detailIncident.severity}</Badge>
              <Badge variant={statusToVariant(detailIncident.status)}>{detailIncident.status}</Badge>
              {detailIncident.affectedService && (
                <span className="text-xs text-text-secondary">Service: {detailIncident.affectedService}</span>
              )}
            </div>
            {detailIncident.rootCauseNotes && (
              <p className="text-sm text-text-secondary">{detailIncident.rootCauseNotes}</p>
            )}
            {/* Timeline */}
            <div>
              <h3 className="text-xs uppercase tracking-wide text-text-secondary mb-2">Timeline</h3>
              <div className="space-y-1.5 mb-3">
                {(detailIncident.timeline ?? []).map((e, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <span className="text-xs text-text-disabled flex-shrink-0">
                      {new Date(e.timestamp).toLocaleString()}
                    </span>
                    <span className="text-text-primary">{e.description}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={timelineNote} onChange={(e) => setTimelineNote(e.target.value)}
                  placeholder="Add timeline note…" className="flex-1" />
                <Button size="sm" variant="secondary" onClick={addTimeline}>Add</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal open={!!resolveId} onClose={() => setResolveId(null)} onConfirm={handleResolve}
        title="Resolve Incident" message="Mark this incident as resolved? This sets the end time to now." />
      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Delete Incident" message="This incident and its timeline will be permanently deleted." />
    </div>
  );
}
