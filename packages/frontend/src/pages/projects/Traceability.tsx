import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { traceabilityService, type TraceChain } from '@/services/traceability.service';
import { PageHeader } from '@/components/ui/PageHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge, statusToVariant } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { ApiError } from '@/lib/api';

function HopSection({ title, items, renderItem }: {
  title: string;
  items: unknown[];
  renderItem: (item: unknown, i: number) => React.ReactNode;
}) {
  if (!items.length) return null;
  return (
    <div className="mb-4">
      <h3 className="text-[11px] uppercase tracking-wider text-text-secondary mb-2">{title}</h3>
      <div className="space-y-1.5">
        {items.map((item, i) => renderItem(item, i))}
      </div>
    </div>
  );
}

function TraceRow({ label, value, status }: { label: string; value: string; status?: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-bg-elevated border border-border-subtle">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[11px] font-mono text-text-secondary flex-shrink-0">{label}</span>
        <span className="text-sm text-text-primary truncate">{value}</span>
      </div>
      {status && <Badge variant={statusToVariant(status)} className="ml-2 flex-shrink-0">{status}</Badge>}
    </div>
  );
}

export function TraceabilityPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [epicKey, setEpicKey] = useState('');
  const [query, setQuery] = useState('');
  const [trace, setTrace] = useState<TraceChain | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setTrace(null);
    try {
      const result = await traceabilityService.getTrace(projectId!, query.trim().toUpperCase());
      setTrace(result);
      setEpicKey(query.trim().toUpperCase());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Trace lookup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title={t('projects.traceability')} />

      {/* Search */}
      <form onSubmit={handleSearch} className="flex items-center gap-3 mb-6">
        <Input
          placeholder="Enter epic key, e.g. PROJ-1"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <Button type="submit" loading={loading}>Trace</Button>
        {loading && <Spinner size="sm" />}
      </form>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-md bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-sm text-status-danger">
          {error}
        </div>
      )}

      {!trace && !loading && !error && (
        <EmptyState
          title="Enter an epic key to trace"
          description="The full chain from Epic → Stories → PRs → Builds → Deployments will appear here."
        />
      )}

      {trace && (
        <div className="space-y-6">
          {/* Epic */}
          <Card>
            <h2 className="text-[11px] uppercase tracking-wider text-text-secondary mb-3">Epic</h2>
            <TraceRow label={trace.epic.key} value={trace.epic.title} status={trace.epic.status} />
          </Card>

          {/* Chain */}
          <Card>
            <HopSection
              title={`Stories (${trace.stories.length})`}
              items={trace.stories}
              renderItem={(s: unknown) => {
                const story = s as TraceChain['stories'][0];
                return <TraceRow key={story.id} label={story.key} value={story.title} status={story.status} />;
              }}
            />
            <HopSection
              title={`Pull Requests (${trace.pullRequests.length})`}
              items={trace.pullRequests}
              renderItem={(pr: unknown) => {
                const p = pr as TraceChain['pullRequests'][0];
                return <TraceRow key={p.id} label={`#${p.number}`} value={p.title} status={p.status} />;
              }}
            />
            <HopSection
              title={`Builds (${trace.builds.length})`}
              items={trace.builds}
              renderItem={(b: unknown) => {
                const build = b as TraceChain['builds'][0];
                return (
                  <TraceRow
                    key={build.id}
                    label={build.status}
                    value={build.name ?? build.id}
                    status={build.coverage !== null ? `${build.coverage}% cov` : undefined}
                  />
                );
              }}
            />
            <HopSection
              title={`Deployments (${trace.deployments.length})`}
              items={trace.deployments}
              renderItem={(d: unknown) => {
                const dep = d as TraceChain['deployments'][0];
                return (
                  <TraceRow
                    key={dep.id}
                    label={dep.environment.toUpperCase()}
                    value={new Date(dep.deployedAt).toLocaleString()}
                    status={dep.status}
                  />
                );
              }}
            />
          </Card>

          {/* Unlinked PRs */}
          {trace.unlinkedPrs.length > 0 && (
            <Card>
              <h2 className="text-[11px] uppercase tracking-wider text-status-warning mb-3">
                Unlinked PRs ({trace.unlinkedPrs.length}) — branch name not parseable
              </h2>
              <div className="space-y-1.5">
                {trace.unlinkedPrs.map((pr) => (
                  <TraceRow key={pr.id} label={`#${pr.number}`} value={pr.branch} />
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
