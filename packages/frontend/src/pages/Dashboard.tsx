import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@/lib/hooks';
import { organizationsService } from '@/services/organizations.service';
import { PageHeader } from '@/components/ui/PageHeader';
import { MetricCard, Card, CardHeader } from '@/components/ui/Card';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

export function DashboardPage() {
  const { t } = useTranslation();
  const { data: orgs, loading } = useQuery(() => organizationsService.list(), []);

  const doraPlaceholders = [
    { key: 'deploymentFrequency', label: t('dashboard.metrics.deploymentFrequency') },
    { key: 'leadTime', label: t('dashboard.metrics.leadTime') },
    { key: 'changeFailureRate', label: t('dashboard.metrics.changeFailureRate') },
    { key: 'mttr', label: t('dashboard.metrics.mttr') },
  ];

  return (
    <div>
      <PageHeader title={t('dashboard.title')} />

      {/* DORA strip — populated per project on project detail page */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {doraPlaceholders.map((m) =>
          loading ? (
            <SkeletonCard key={m.key} />
          ) : (
            <MetricCard key={m.key} label={m.label} value={null} />
          ),
        )}
      </div>

      {/* Organizations overview */}
      <Card>
        <CardHeader
          title={t('organizations.title')}
          action={
            <Link to="/organizations">
              <Button variant="secondary" size="sm">View all</Button>
            </Link>
          }
        />
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-10 rounded bg-bg-elevated animate-pulse" />
            ))}
          </div>
        ) : !orgs?.length ? (
          <EmptyState
            title="No organizations yet"
            description="Create an organization to start managing your SDLC."
            action={
              <Link to="/organizations">
                <Button size="sm">Create Organization</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            {orgs.slice(0, 5).map((org) => (
              <Link
                key={org.id}
                to={`/organizations/${org.id}`}
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-text-primary">{org.name}</p>
                  <p className="text-xs text-text-secondary">{org.key}</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-text-secondary">
                  <span>{org._count?.projects ?? 0} projects</span>
                  <span>{org._count?.memberships ?? 0} members</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
