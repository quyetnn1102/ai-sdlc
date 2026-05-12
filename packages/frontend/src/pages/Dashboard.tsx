import { useTranslation } from 'react-i18next';

const doraMetrics = [
  { key: 'deploymentFrequency', value: '4.2/wk', trend: '+12%', positive: true },
  { key: 'leadTime', value: '2.3 days', trend: '-8%', positive: true },
  { key: 'changeFailureRate', value: '3.1%', trend: '-2%', positive: true },
  { key: 'mttr', value: '45 min', trend: '-15%', positive: true },
];

export function DashboardPage() {
  const { t } = useTranslation();

  return (
    <div>
      <h1 className="text-lg font-semibold text-text-primary mb-6">
        {t('dashboard.title')}
      </h1>

      {/* DORA Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {doraMetrics.map((metric) => (
          <div
            key={metric.key}
            className="p-5 rounded-xl bg-bg-surface border border-border-subtle"
          >
            <p className="text-xs uppercase text-text-secondary tracking-wide mb-2">
              {t(`dashboard.metrics.${metric.key}`)}
            </p>
            <p className="text-2xl font-bold text-text-primary tabular-nums">
              {metric.value}
            </p>
            <p
              className={`text-xs mt-1 ${
                metric.positive ? 'text-status-success' : 'text-status-danger'
              }`}
            >
              {metric.trend}
            </p>
          </div>
        ))}
      </div>

      {/* Placeholder for recent activity */}
      <div className="p-6 rounded-xl bg-bg-surface border border-border-subtle">
        <h2 className="text-md font-medium text-text-primary mb-4">Recent Activity</h2>
        <p className="text-sm text-text-secondary">{t('common.noData')}</p>
      </div>
    </div>
  );
}
