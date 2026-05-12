import { useTranslation } from 'react-i18next';

const integrations = [
  { name: 'Jira', status: 'connected', lastSync: '2 min ago' },
  { name: 'GitHub', status: 'connected', lastSync: '5 min ago' },
  { name: 'SonarQube', status: 'degraded', lastSync: '2 hours ago' },
  { name: 'GitHub Actions', status: 'disconnected', lastSync: 'Never' },
];

export function SettingsPage() {
  const { t } = useTranslation();

  return (
    <div>
      <h1 className="text-lg font-semibold text-text-primary mb-6">
        {t('projects.settings')}
      </h1>

      {/* Integration cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((integration) => (
          <div
            key={integration.name}
            className="p-5 rounded-xl bg-bg-surface border border-border-subtle"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-text-primary">
                {integration.name}
              </h3>
              <span
                className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                  integration.status === 'connected'
                    ? 'bg-[#22C55E20] text-status-success border border-[#22C55E40]'
                    : integration.status === 'degraded'
                      ? 'bg-[#F59E0B20] text-status-warning border border-[#F59E0B40]'
                      : 'bg-[#EF444420] text-status-danger border border-[#EF444440]'
                }`}
              >
                {integration.status}
              </span>
            </div>
            <p className="text-xs text-text-secondary mb-3">
              Last synced: {integration.lastSync}
            </p>
            <button className="h-7 px-3 rounded-md bg-transparent border border-border-default text-xs text-text-primary hover:bg-bg-hover transition-colors">
              Test Connection
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
