import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@/lib/hooks';
import { projectsService } from '@/services/projects.service';
import { metricsService } from '@/services/metrics.service';
import { TabsNav } from '@/components/ui/Tabs';
import { MetricCard } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonCard } from '@/components/ui/Skeleton';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  const { data: project, loading: projLoading } = useQuery(
    () => projectsService.get(id!), [id],
  );
  const { data: dora, loading: doraLoading } = useQuery(
    () => metricsService.dora(id!, '30d'), [id],
  );

  const tabs = [
    { path: `/projects/${id}/kanban`,   label: t('projects.kanban') },
    { path: `/projects/${id}/workflow`, label: t('projects.workflow') },
    { path: `/projects/${id}/gates`,    label: t('projects.gates') },
    { path: `/projects/${id}/metrics`,  label: t('projects.metrics') },
    { path: `/projects/${id}/trace`,    label: t('projects.traceability') },
    { path: `/projects/${id}/retros`,   label: t('projects.retrospectives') },
    { path: `/projects/${id}/tests`,    label: 'Tests' },
    { path: `/projects/${id}/incidents`,label: 'Incidents' },
    { path: `/projects/${id}/settings`, label: t('projects.settings') },
  ];

  return (
    <div>
      <PageHeader
        title={projLoading ? '…' : (project?.name ?? 'Project')}
        breadcrumbs={[
          { label: project?.organization?.name ?? '…' },
          { label: project?.name ?? '…' },
        ]}
        description={project?.description}
      />

      {/* DORA metric strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {doraLoading ? (
          [1,2,3,4].map((i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <MetricCard
              label={t('dashboard.metrics.deploymentFrequency')}
              value={dora?.deploymentFrequency.perWeek?.toFixed(1) ?? null}
              suffix="/wk"
            />
            <MetricCard
              label={t('dashboard.metrics.leadTime')}
              value={dora?.leadTime.avgDays ?? null}
              suffix="days"
            />
            <MetricCard
              label={t('dashboard.metrics.changeFailureRate')}
              value={dora?.changeFailureRate.rate ?? null}
              suffix="%"
            />
            <MetricCard
              label={t('dashboard.metrics.mttr')}
              value={dora?.mttr.avgMinutes ?? null}
              suffix="min"
            />
          </>
        )}
      </div>

      {/* Project navigation tabs */}
      <TabsNav tabs={tabs} />

      {/* Sub-routes render here if this page is a layout — or show summary card */}
      <div className="p-6 rounded-xl bg-bg-surface border border-border-subtle text-sm text-text-secondary">
        Select a tab above to explore this project.
      </div>
    </div>
  );
}
