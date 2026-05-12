import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@/lib/hooks';
import { organizationsService, type CreateOrgPayload } from '@/services/organizations.service';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { ApiError } from '@/lib/api';

export function OrganizationsPage() {
  const { t } = useTranslation();
  const { data: orgs, loading, error, refetch } = useQuery(() => organizationsService.list(), []);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CreateOrgPayload>({ name: '', key: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await organizationsService.create(form);
      setModalOpen(false);
      setForm({ name: '', key: '', description: '' });
      refetch();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t('organizations.title')}
        actions={<Button onClick={() => setModalOpen(true)}>{t('organizations.create')}</Button>}
      />

      <ErrorAlert message={error} onRetry={refetch} />

      <Table
        loading={loading}
        rows={orgs ?? []}
        emptyMessage="No organizations yet"
        onRowClick={(row) => window.location.assign(`/organizations/${row.id}`)}
        columns={[
          { key: 'name', header: t('organizations.name'), render: (r) => (
            <Link to={`/organizations/${r.id}`} className="font-medium text-text-primary hover:text-accent-primary">
              {r.name}
            </Link>
          )},
          { key: 'key', header: t('organizations.key'), width: '120px', render: (r) => (
            <span className="text-text-secondary font-mono text-xs">{r.key}</span>
          )},
          { key: 'members', header: t('organizations.members'), width: '100px', render: (r) => (
            <span className="text-text-secondary">{r._count?.memberships ?? 0}</span>
          )},
          { key: 'projects', header: t('organizations.projects'), width: '100px', render: (r) => (
            <span className="text-text-secondary">{r._count?.projects ?? 0}</span>
          )},
        ]}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t('organizations.create')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button form="create-org-form" type="submit" loading={saving}>Create</Button>
          </>
        }
      >
        {formError && (
          <div className="mb-4 text-sm text-status-danger bg-[rgba(239,68,68,0.1)] px-3 py-2 rounded-md">
            {formError}
          </div>
        )}
        <form id="create-org-form" onSubmit={handleCreate} className="space-y-4">
          <Input label={t('organizations.name')} value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label={t('organizations.key')} value={form.key} placeholder="e.g. ACME"
            onChange={(e) => setForm({ ...form, key: e.target.value.toUpperCase() })} required />
          <Input label={t('organizations.description')} value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </form>
      </Modal>
    </div>
  );
}
