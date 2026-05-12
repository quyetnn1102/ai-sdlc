import { useParams, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  const tabs = [
    { path: `/projects/${id}/kanban`, label: t('projects.kanban') },
    { path: `/projects/${id}/workflow`, label: t('projects.workflow') },
    { path: `/projects/${id}/gates`, label: t('projects.gates') },
    { path: `/projects/${id}/settings`, label: t('projects.settings') },
  ];

  return (
    <div>
      <h1 className="text-lg font-semibold text-text-primary mb-4">
        Project Detail
      </h1>

      {/* Project Nav Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border-subtle pb-0">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              `px-3 py-2 text-sm rounded-t-md transition-colors ${
                isActive
                  ? 'text-text-primary border-b-2 border-accent-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      {/* Metric strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {['Deployment Freq', 'Lead Time', 'Failure Rate', 'MTTR'].map((label) => (
          <div
            key={label}
            className="p-4 rounded-xl bg-bg-surface border border-border-subtle"
          >
            <p className="text-xs uppercase text-text-secondary tracking-wide mb-1">
              {label}
            </p>
            <p className="text-xl font-bold text-text-primary tabular-nums">—</p>
          </div>
        ))}
      </div>

      {/* Placeholder content */}
      <div className="p-6 rounded-xl bg-bg-surface border border-border-subtle">
        <p className="text-sm text-text-secondary">{t('common.noData')}</p>
      </div>
    </div>
  );
}
