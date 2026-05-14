/**
 * WorkspaceSidebar — Persistent sidebar panel showing live counts,
 * active epic run statuses, slash commands, and config warnings.
 * Uses useWorkspaceSocket for real-time updates.
 */
import { Link } from 'react-router-dom';
import { useQuery } from '@/lib/hooks';
import { Badge } from '@/components/ui/Badge';
import { useWorkspaceSocket } from '../hooks/useWorkspaceSocket';
import { workspaceApi, type SlashCommand } from '../api/workspace.service';

interface WorkspaceSidebarProps {
  projectId: string;
}

export function WorkspaceSidebar({ projectId }: WorkspaceSidebarProps) {
  // Initial data fetch
  const { data: initialStatus } = useQuery(
    () => workspaceApi.getStatus(projectId),
    [projectId],
  );

  // Live updates via WebSocket
  const { connected, status: liveStatus } = useWorkspaceSocket({ projectId });

  // Use live status if available, otherwise fall back to initial fetch
  const status = liveStatus ?? initialStatus;

  const slashCommands: SlashCommand[] = status?.slashCommands ?? [];
  const activeRuns = status?.activeRuns ?? {};

  const runningCount = (activeRuns as Record<string, number>).running ?? 0;
  const pausedCount = (activeRuns as Record<string, number>).paused ?? 0;
  const failedCount = (activeRuns as Record<string, number>).failed ?? 0;

  const hasConfigWarning = !status;

  return (
    <aside className="w-64 flex-shrink-0 space-y-5">
      {/* Connection indicator */}
      <div className="flex items-center gap-2 text-xs text-text-secondary">
        <span
          className={`w-2 h-2 rounded-full ${connected ? 'bg-status-success' : 'bg-status-danger'}`}
        />
        {connected ? 'Live' : 'Disconnected'}
      </div>

      {/* Entity counts */}
      <div className="rounded-xl bg-bg-surface border border-border-subtle p-4 space-y-3">
        <h3 className="text-[11px] font-medium text-text-secondary uppercase tracking-wide">
          Workspace
        </h3>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-semibold text-text-primary">{status?.agents ?? 0}</p>
            <p className="text-[10px] text-text-secondary">Agents</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-text-primary">{status?.skills ?? 0}</p>
            <p className="text-[10px] text-text-secondary">Skills</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-text-primary">{status?.pipelines ?? 0}</p>
            <p className="text-[10px] text-text-secondary">Pipelines</p>
          </div>
        </div>
      </div>

      {/* Active runs */}
      <div className="rounded-xl bg-bg-surface border border-border-subtle p-4 space-y-3">
        <h3 className="text-[11px] font-medium text-text-secondary uppercase tracking-wide">
          Active Runs
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">Running</span>
            <Badge variant={runningCount > 0 ? 'info' : 'neutral'}>{runningCount}</Badge>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">Paused</span>
            <Badge variant={pausedCount > 0 ? 'warning' : 'neutral'}>{pausedCount}</Badge>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">Failed</span>
            <Badge variant={failedCount > 0 ? 'danger' : 'neutral'}>{failedCount}</Badge>
          </div>
        </div>
      </div>

      {/* Slash commands */}
      <div className="rounded-xl bg-bg-surface border border-border-subtle p-4 space-y-3">
        <h3 className="text-[11px] font-medium text-text-secondary uppercase tracking-wide">
          Slash Commands
        </h3>
        {slashCommands.length === 0 ? (
          <p className="text-xs text-text-disabled">No commands configured.</p>
        ) : (
          <ul className="space-y-1.5">
            {slashCommands.map((cmd) => (
              <li key={cmd.name}>
                <button
                  type="button"
                  className="w-full text-left px-2 py-1.5 rounded-md text-xs hover:bg-bg-hover transition-colors"
                >
                  <span className="font-mono text-accent-primary">{cmd.name}</span>
                  <span className="text-text-secondary ml-2">{cmd.description}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Navigation links */}
      <div className="rounded-xl bg-bg-surface border border-border-subtle p-4 space-y-2">
        <h3 className="text-[11px] font-medium text-text-secondary uppercase tracking-wide">
          Navigation
        </h3>
        <Link
          to={`/projects/${projectId}/workspace/epics`}
          className="block w-full text-left px-2 py-1.5 rounded-md text-xs hover:bg-bg-hover transition-colors text-accent-primary"
        >
          📋 Epics
        </Link>
      </div>

      {/* Config warning */}
      {hasConfigWarning && (
        <div className="rounded-lg bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.2)] p-3">
          <p className="text-xs text-status-warning">
            ⚠ Workspace config not loaded. Check your connection.
          </p>
        </div>
      )}
    </aside>
  );
}
