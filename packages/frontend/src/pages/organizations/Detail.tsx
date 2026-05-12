import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@/lib/hooks';
import { organizationsService, type CreateProjectPayload } from '@/services/organizations.service';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { ApiError } from '@/lib/api';

export function OrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { data: org, loading, refetch } = useQuery(() => organizationsService.get(id!), [id]);

  const [projectModal, setProjectModal] = useState(false);
  const [projectForm, setProjectForm] = useState<CreateProjectPayload>({ name: '', key: '', timezone: 'UTC' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await organizationsService.createProject(id!, projectForm);
      setProjectModal(false);
      setProjectForm({ name: '', key: '', timezone: 'UTC' });
      refetch();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create project');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="h-40 rounded-xl bg-bg-surface border border-border-subtle animate-pulse" />;
  if (!org) return <p className="text-text-secondary">Organization not found.</p>;

  return (
    <div>
      <PageHeader
        title={org.name}
        breadcrumbs={[{ label: t('organizations.title'), href: '/organizations' }, { label: org.name }]}
        description={org.description}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projects */}
        <Card>
          <CardHeader
            title={t('organizations.projects')}
            action={<Button size="sm" onClick={() => setProjectModal(true)}>{t('projects.create')}</Button>}
          />
          {!org.projects?.length ? (
            <EmptyState title="No projects yet" action={
              <Button size="sm" onClick={() => setProjectModal(true)}>{t('projects.create')}</Button>
            } />
          ) : (
            <div className="space-y-2">
              {org.projects.map((p) => (
                <Link key={p.id} to={`/projects/${p.id}`}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{p.name}</p>
                    <p className="text-xs text-text-secondary font-mono">{p.key}</p>
                  </div>
                  <span className="text-xs text-text-disabled">{p.timezone}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Members */}
        <Card>
          <CardHeader title={t('organizations.members')} />
          {!org.memberships?.length ? (
            <EmptyState title="No members yet" />
          ) : (
            <div className="space-y-2">
              {org.memberships.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{m.user.name}</p>
                    <p className="text-xs text-text-secondary">{m.user.email}</p>
                  </div>
                  <Badge variant="neutral">{m.role}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Create project modal */}
      <Modal open={projectModal} onClose={() => setProjectModal(false)}
        title={t('projects.create')} size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setProjectModal(false)}>Cancel</Button>
            <Button form="create-proj-form" type="submit" loading={saving}>Create</Button>
          </>
        }
      >
        {formError && <div className="mb-4 text-sm text-status-danger bg-[rgba(239,68,68,0.1)] px-3 py-2 rounded-md">{formError}</div>}
        <form id="create-proj-form" onSubmit={handleCreateProject} className="space-y-4">
          <Input label={t('projects.name')} value={projectForm.name}
            onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} required />
          <Input label={t('projects.key')} value={projectForm.key} placeholder="e.g. MOB"
            onChange={(e) => setProjectForm({ ...projectForm, key: e.target.value.toUpperCase() })} required />
          <Input label={t('projects.description')} value={projectForm.description ?? ''}
            onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} />
          <Input label={t('projects.timezone')} value={projectForm.timezone ?? 'UTC'}
            onChange={(e) => setProjectForm({ ...projectForm, timezone: e.target.value })} />
        </form>
      </Modal>
    </div>
  );
}
