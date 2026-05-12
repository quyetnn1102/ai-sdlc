import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@/lib/hooks';
import {
  integrationsService,
  type Integration,
  type CreateIntegrationPayload,
  type IntegrationType,
} from '@/services/integrations.service';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, statusToVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';

const INTEGRATION_TYPES: Array<{ value: IntegrationType; label: string }> = [
  { value: 'JIRA',           label: 'Jira' },
  { value: 'GITHUB',         label: 'GitHub' },
  { value: 'GITHUB_ACTIONS', label: 'GitHub Actions' },
  { value: 'SONARQUBE',      label: 'SonarQube' },
  { value: 'GITLAB',         label: 'GitLab' },
  { value: 'GITLAB_CI',      label: 'GitLab CI' },
  { value: 'JENKINS',        label: 'Jenkins' },
  { value: 'PAGERDUTY',      label: 'PagerDuty' },
];

function IntegrationCard({
  integration,
  onTest,
  onDelete,
}: {
  integration: Integration;
  onTest: () => void;
  onDelete: () => void;
}) {
  const [testing, setTesting] = useState(false);

  async function handleTest() {
    setTesting(true);
    try { await onTest(); }
    finally { setTesting(false); }
  }

  return (
    <div className="p-5 rounded-xl bg-bg-surface border border-border-subtle">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">{integration.type}</h3>
        <Badge variant={statusToVariant(integration.status)}>
          {integration.status}
        </Badge>
      </div>
      <p className="text-xs text-text-secondary mb-4">
        Last synced: {integration.lastSyncAt
          ? new Date(integration.lastSyncAt).toLocaleString()
          : 'Never'}
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={handleTest} loading={testing}>
          Test Connection
        </Button>
        <Button size="sm" variant="danger" onClick={onDelete}>Remove</Button>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { data: integrations, loading, refetch } = useQuery(
    () => integrationsService.list(projectId!), [projectId],
  );

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<CreateIntegrationPayload & {
    base_url?: string; api_token?: string; project_key?: string;
  }>({ type: 'JIRA' });
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const settings: Record<string, string> = {};
      if (form.base_url) settings['base_url'] = form.base_url;
      if (form.api_token) settings['api_token'] = form.api_token;
      if (form.project_key) settings['project_key'] = form.project_key;
      await integrationsService.create(projectId!, { type: form.type, settings });
      setAddOpen(false);
      setForm({ type: 'JIRA' });
      refetch();
    } finally { setSaving(false); }
  }

  async function testIntegration(id: string) {
    await integrationsService.test(id);
  }

  async function deleteIntegration(id: string) {
    await integrationsService.delete(id);
    refetch();
  }

  return (
    <div>
      <PageHeader
        title={t('projects.settings')}
        actions={<Button size="sm" onClick={() => setAddOpen(true)}>+ Add Integration</Button>}
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3].map((i) => (
            <div key={i} className="h-36 rounded-xl bg-bg-surface border border-border-subtle animate-pulse" />
          ))}
        </div>
      ) : !integrations?.length ? (
        <EmptyState
          title="No integrations configured"
          description="Connect Jira, GitHub, SonarQube and more to start ingesting data."
          action={<Button size="sm" onClick={() => setAddOpen(true)}>Add Integration</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onTest={() => testIntegration(integration.id)}
              onDelete={() => deleteIntegration(integration.id)}
            />
          ))}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Integration" size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" form="add-integration-form" type="submit" loading={saving}>Add</Button>
          </>
        }
      >
        <form id="add-integration-form" onSubmit={handleAdd} className="space-y-4">
          <Select
            label="Integration type"
            value={form.type}
            options={INTEGRATION_TYPES}
            onChange={(e) => setForm({ ...form, type: e.target.value as IntegrationType })}
          />
          <Input label="Base URL" placeholder="https://your-instance.atlassian.net"
            value={form.base_url ?? ''} onChange={(e) => setForm({ ...form, base_url: e.target.value })} />
          <Input label="API Token" type="password" placeholder="Stored encrypted"
            value={form.api_token ?? ''} onChange={(e) => setForm({ ...form, api_token: e.target.value })} />
          <Input label="Project Key" placeholder="e.g. PROJ"
            value={form.project_key ?? ''} onChange={(e) => setForm({ ...form, project_key: e.target.value })} />
        </form>
      </Modal>
    </div>
  );
}
