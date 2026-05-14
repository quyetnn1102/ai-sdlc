/**
 * EpicsListPage — Displays all epic runs in a filterable, sortable table.
 * Route: /projects/:id/workspace/epics
 * Polls every 10 seconds for updates.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Badge, statusToVariant } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { TokenUsageBadge } from '../components/TokenUsageBadge';
import {
  epicRunsApi,
  tokenUsageApi,
  type EpicRun,
  type EpicRunStatus,
} from '../api/workspace.service';

type SortField = 'date' | 'tokens';
type SortDir = 'asc' | 'desc';

const STATUS_OPTIONS: EpicRunStatus[] = ['pending', 'running', 'paused', 'completed', 'failed', 'cancelled'];

export function EpicsListPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [runs, setRuns] = useState<EpicRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<EpicRunStatus | ''>('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [tokenMap, setTokenMap] = useState<Record<string, number>>({});
  const [stale, setStale] = useState(false);
  const failCountRef = useRef(0);

  const fetchRuns = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await epicRunsApi.list(projectId, statusFilter || undefined);
      setRuns(data);
      failCountRef.current = 0;
      setStale(false);

      // Fetch token usage for each run
      const tokenEntries = await Promise.allSettled(
        data.map(async (run) => {
          const usage = await tokenUsageApi.epicRunUsage(projectId, run.id);
          return [run.id, usage.totalInputTokens + usage.totalOutputTokens] as [string, number];
        }),
      );
      const map: Record<string, number> = {};
      tokenEntries.forEach((result) => {
        if (result.status === 'fulfilled') {
          const [id, tokens] = result.value;
          map[id] = tokens;
        }
      });
      setTokenMap(map);
    } catch {
      failCountRef.current += 1;
      if (failCountRef.current >= 3) setStale(true);
    } finally {
      setLoading(false);
    }
  }, [projectId, statusFilter]);

  useEffect(() => {
    fetchRuns();
    const interval = setInterval(fetchRuns, 10_000);
    return () => clearInterval(interval);
  }, [fetchRuns]);

  const sortedRuns = useMemo(() => {
    const sorted = [...runs];
    sorted.sort((a, b) => {
      if (sortField === 'date') {
        const da = new Date(a.createdAt).getTime();
        const db = new Date(b.createdAt).getTime();
        return sortDir === 'asc' ? da - db : db - da;
      }
      const ta = tokenMap[a.id] ?? 0;
      const tb = tokenMap[b.id] ?? 0;
      return sortDir === 'asc' ? ta - tb : tb - ta;
    });
    return sorted;
  }, [runs, sortField, sortDir, tokenMap]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Epics</h1>
          <p className="text-sm text-text-secondary">Manage and monitor your epic runs.</p>
        </div>
        <Link to={`/projects/${projectId}/workspace`}>
          <Button variant="secondary" size="sm">← Back to Workspace</Button>
        </Link>
      </div>

      {stale && (
        <p className="text-[11px] text-status-warning">⚠ Data may be stale — connection issues</p>
      )}

      {/* Filters and sort */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as EpicRunStatus | '')}
          className="text-xs px-2 py-1.5 rounded-lg border border-border-subtle bg-bg-elevated text-text-primary"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => toggleSort('date')}
          className={`text-xs px-2 py-1.5 rounded-lg border transition-colors ${sortField === 'date' ? 'border-accent-primary text-accent-primary' : 'border-border-subtle text-text-secondary'}`}
        >
          Date {sortField === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
        </button>

        <button
          type="button"
          onClick={() => toggleSort('tokens')}
          className={`text-xs px-2 py-1.5 rounded-lg border transition-colors ${sortField === 'tokens' ? 'border-accent-primary text-accent-primary' : 'border-border-subtle text-text-secondary'}`}
        >
          Tokens {sortField === 'tokens' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
        </button>
      </div>

      {/* Table / Empty state */}
      {sortedRuns.length === 0 ? (
        <EmptyState
          title="No epic runs yet"
          description="Start a new epic run from a pipeline to see it here."
          action={
            <Link to={`/projects/${projectId}/workspace`}>
              <Button size="sm">Go to Workspace</Button>
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border-subtle">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-elevated text-text-secondary text-xs">
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Progress</th>
                <th className="text-left px-4 py-2 font-medium">Pipeline</th>
                <th className="text-left px-4 py-2 font-medium">Work Item</th>
                <th className="text-left px-4 py-2 font-medium">Tokens</th>
                <th className="text-left px-4 py-2 font-medium">Date</th>
                <th className="text-left px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {sortedRuns.map((run) => {
                const completedSteps = run.steps.filter(
                  (s) => s.status === 'approved' || s.status === 'completed',
                ).length;
                const totalSteps = run.steps.length;
                const tokens = tokenMap[run.id] ?? null;

                return (
                  <tr key={run.id} className="hover:bg-bg-hover transition-colors">
                    <td className="px-4 py-3">
                      <Badge variant={statusToVariant(run.status)}>{run.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary">
                      {completedSteps}/{totalSteps}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-primary">{run.pipelineId}</td>
                    <td className="px-4 py-3 text-xs text-text-primary">{run.workItemId}</td>
                    <td className="px-4 py-3">
                      <TokenUsageBadge tokens={tokens} />
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary">
                      {new Date(run.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/projects/${projectId}/workspace/runs/${run.id}`}
                        className="text-xs text-accent-primary hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
