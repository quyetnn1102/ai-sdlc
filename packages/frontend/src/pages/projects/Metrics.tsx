import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@/lib/hooks';
import { metricsService, type Period } from '@/services/metrics.service';
import { PageHeader } from '@/components/ui/PageHeader';
import { MetricCard } from '@/components/ui/Card';
import { StaticTabs } from '@/components/ui/Tabs';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
];

export function MetricsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>('30d');

  const { data: dora, loading: doraLoading } = useQuery(
    () => metricsService.dora(projectId!, period),
    [projectId, period],
  );
  const { data: flow, loading: flowLoading } = useQuery(
    () => metricsService.flow(projectId!, period),
    [projectId, period],
  );

  return (
    <div>
      <PageHeader title={t('projects.metrics')} />

      {/* Period selector */}
      <div className="mb-6">
        <StaticTabs
          tabs={PERIODS.map((p) => ({ key: p.key, label: p.label }))}
          active={period}
          onChange={(k) => setPeriod(k as Period)}
        />
      </div>

      {/* DORA Metrics */}
      <h2 className="text-[13px] font-medium text-text-secondary uppercase tracking-wide mb-3">DORA Metrics</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {doraLoading ? (
          [1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <MetricCard
              label={t('dashboard.metrics.deploymentFrequency')}
              value={dora?.deploymentFrequency.perWeek?.toFixed(1) ?? null}
              suffix="/wk"
              loading={doraLoading}
            />
            <MetricCard
              label={t('dashboard.metrics.leadTime')}
              value={dora?.leadTime.avgDays ?? null}
              suffix="days"
              loading={doraLoading}
            />
            <MetricCard
              label={t('dashboard.metrics.changeFailureRate')}
              value={dora?.changeFailureRate.rate ?? null}
              suffix="%"
              loading={doraLoading}
            />
            <MetricCard
              label={t('dashboard.metrics.mttr')}
              value={dora?.mttr.avgMinutes ?? null}
              suffix="min avg"
              loading={doraLoading}
            />
          </>
        )}
      </div>

      {/* MTTR detail */}
      {!doraLoading && dora?.mttr.samples ? (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <MetricCard label="MTTR p50" value={dora.mttr.p50Minutes} suffix="min" />
          <MetricCard label="MTTR p90" value={dora.mttr.p90Minutes} suffix="min" />
          <MetricCard label="Incident Samples" value={dora.mttr.samples} />
        </div>
      ) : null}

      {/* Flow Metrics */}
      <h2 className="text-[13px] font-medium text-text-secondary uppercase tracking-wide mb-3">Flow Metrics</h2>
      {flowLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <MetricCard
            label="Throughput"
            value={flow?.throughput.count ?? null}
            suffix={`items / ${flow?.throughput.days ?? period.replace('d', '')}d`}
          />
          {(flow?.wip ?? []).map((w) => (
            <MetricCard key={w.phase} label={`WIP – ${w.phase}`} value={w.count} />
          ))}
        </div>
      )}

      {/* Avg age per phase */}
      {flow?.avgAge?.length ? (
        <>
          <h2 className="text-[13px] font-medium text-text-secondary uppercase tracking-wide mb-3">
            Avg Age by Phase
          </h2>
          <div className="rounded-xl bg-bg-surface border border-border-subtle overflow-hidden mb-8">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-default">
                  <th className="text-left px-4 h-10 text-[11px] uppercase tracking-wide text-text-secondary font-medium">Phase</th>
                  <th className="text-left px-4 h-10 text-[11px] uppercase tracking-wide text-text-secondary font-medium">Avg Age (days)</th>
                </tr>
              </thead>
              <tbody>
                {flow.avgAge.map((row) => (
                  <tr key={row.phase} className="border-b border-border-subtle last:border-0">
                    <td className="px-4 h-10 text-sm text-text-primary">{row.phase}</td>
                    <td className="px-4 h-10 text-sm tabular-nums text-text-primary">{row.avgAgeDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : !flowLoading ? (
        <EmptyState title="No flow data yet" description="Flow metrics appear once work items are assigned to phases." />
      ) : null}
    </div>
  );
}
