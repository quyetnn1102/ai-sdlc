import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@/lib/hooks';
import { retrospectivesService, type Retrospective, type CreateRetroPayload } from '@/services/retrospectives.service';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/Input';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ApiError } from '@/lib/api';

function RetroCard({ retro, onEdit, onDelete }: {
  retro: Retrospective;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="p-5 rounded-xl bg-bg-surface border border-border-subtle">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{retro.title}</h3>
          {retro.sprintName && (
            <p className="text-xs text-text-secondary mt-0.5">{retro.sprintName}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onEdit}>Edit</Button>
          <Button size="sm" variant="danger" onClick={onDelete}>Delete</Button>
        </div>
      </div>

      {retro.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {retro.tags.map((tag) => (
            <Badge key={tag} variant="neutral">{tag}</Badge>
          ))}
        </div>
      )}

      {retro.wentWell && (
        <div className="mb-2">
          <p className="text-[11px] uppercase tracking-wide text-status-success mb-1">Went Well</p>
          <p className="text-sm text-text-secondary whitespace-pre-line">{retro.wentWell}</p>
        </div>
      )}
      {retro.wentWrong && (
        <div className="mb-2">
          <p className="text-[11px] uppercase tracking-wide text-status-danger mb-1">Went Wrong</p>
          <p className="text-sm text-text-secondary whitespace-pre-line">{retro.wentWrong}</p>
        </div>
      )}

      {retro.actionItems && retro.actionItems.length > 0 && (
        <div className="mt-3 border-t border-border-subtle pt-3">
          <p className="text-[11px] uppercase tracking-wide text-text-disabled mb-2">Action Items</p>
          <div className="space-y-1">
            {retro.actionItems.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className={item.completed ? 'text-status-success' : 'text-text-disabled'}>
                  {item.completed ? '✓' : '○'}
                </span>
                <span className={`flex-1 ${item.completed ? 'line-through text-text-disabled' : 'text-text-primary'}`}>
                  {item.text}
                </span>
                {item.owner && <span className="text-xs text-text-secondary">→ {item.owner}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-text-disabled mt-3">
        {new Date(retro.createdAt).toLocaleDateString()}
      </p>
    </div>
  );
}

const EMPTY_FORM: CreateRetroPayload = {
  title: '', sprintName: '', wentWell: '', wentWrong: '',
  actionItems: [], tags: [],
};

export function RetrosPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { data: retros, loading, refetch } = useQuery(
    () => retrospectivesService.list(projectId!), [projectId],
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateRetroPayload>(EMPTY_FORM);
  const [actionText, setActionText] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setActionText('');
    setTagsInput('');
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(retro: Retrospective) {
    setEditingId(retro.id);
    setForm({
      title: retro.title,
      sprintName: retro.sprintName ?? '',
      wentWell: retro.wentWell ?? '',
      wentWrong: retro.wentWrong ?? '',
      actionItems: retro.actionItems ?? [],
      tags: retro.tags ?? [],
    });
    setTagsInput((retro.tags ?? []).join(', '));
    setFormError('');
    setModalOpen(true);
  }

  function addActionItem() {
    if (!actionText.trim()) return;
    setForm({ ...form, actionItems: [...(form.actionItems ?? []), { text: actionText, completed: false }] });
    setActionText('');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    const payload: CreateRetroPayload = {
      ...form,
      tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
    };
    try {
      if (editingId) {
        await retrospectivesService.update(projectId!, editingId, payload);
      } else {
        await retrospectivesService.create(projectId!, payload);
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    await retrospectivesService.delete(projectId!, deleteId);
    setDeleteId(null);
    refetch();
  }

  return (
    <div>
      <PageHeader
        title={t('projects.retrospectives')}
        actions={<Button onClick={openCreate}>+ New Retro</Button>}
      />

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => <div key={i} className="h-40 rounded-xl bg-bg-surface border border-border-subtle animate-pulse" />)}
        </div>
      ) : !retros?.length ? (
        <EmptyState
          title="No retrospectives yet"
          description="Create your first retro to capture what went well, what didn't, and action items."
          action={<Button onClick={openCreate}>New Retro</Button>}
        />
      ) : (
        <div className="space-y-4">
          {retros.map((r) => (
            <RetroCard
              key={r.id}
              retro={r}
              onEdit={() => openEdit(r)}
              onDelete={() => setDeleteId(r.id)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Retrospective' : 'New Retrospective'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button form="retro-form" type="submit" loading={saving}>
              {editingId ? 'Save' : 'Create'}
            </Button>
          </>
        }
      >
        {formError && <div className="mb-4 text-sm text-status-danger bg-[rgba(239,68,68,0.1)] px-3 py-2 rounded-md">{formError}</div>}
        <form id="retro-form" onSubmit={handleSave} className="space-y-4">
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <Input label="Sprint / Time Range" value={form.sprintName ?? ''} onChange={(e) => setForm({ ...form, sprintName: e.target.value })} placeholder="e.g. Sprint 23" />
          <TextArea label="What went well ✓" value={form.wentWell ?? ''} onChange={(e) => setForm({ ...form, wentWell: e.target.value })} rows={3} />
          <TextArea label="What went wrong ✗" value={form.wentWrong ?? ''} onChange={(e) => setForm({ ...form, wentWrong: e.target.value })} rows={3} />
          <Input label="Tags (comma separated)" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="e.g. process, backend" />

          {/* Action items */}
          <div>
            <label className="text-xs text-text-secondary mb-1.5 block">Action Items</label>
            <div className="space-y-1 mb-2">
              {(form.actionItems ?? []).map((item, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-md bg-bg-elevated">
                  <span className="text-sm text-text-primary">{item.text}</span>
                  <button type="button" onClick={() => setForm({ ...form, actionItems: form.actionItems!.filter((_, j) => j !== i) })}
                    className="text-text-disabled hover:text-status-danger text-xs ml-2">✕</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={actionText} onChange={(e) => setActionText(e.target.value)}
                placeholder="Add action item…" className="flex-1" />
              <Button type="button" size="sm" variant="secondary" onClick={addActionItem}>Add</Button>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Retrospective"
        message="This retrospective and all its action items will be permanently deleted."
      />
    </div>
  );
}
