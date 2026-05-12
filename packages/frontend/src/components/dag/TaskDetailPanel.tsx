/**
 * TaskDetailPanel — side panel opened when a DAG node is clicked.
 * Shows task status, agent info, elapsed time, artifacts, and error details.
 */

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import type { DagTask } from './DagVisualization';

interface Artifact {
  id: string;
  name: string;
  artifactType: string;
  contentRef: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface TaskDetailPanelProps {
  task: DagTask | null;
  artifacts?: Artifact[];
  onClose: () => void;
  className?: string;
}

type BV = 'success' | 'danger' | 'warning' | 'pending' | 'info' | 'neutral';
function statusVariant(s: string): BV {
  if (['DONE'].includes(s))                      return 'success';
  if (['FAILED', 'TIMED_OUT'].includes(s))       return 'danger';
  if (['RUNNING'].includes(s))                   return 'info';
  if (['STARTING'].includes(s))                  return 'warning';
  if (['CANCELLED', 'SKIPPED'].includes(s))      return 'neutral';
  return 'pending';
}

function formatMs(ms: number | null | undefined): string {
  if (!ms) return '—';
  if (ms < 1000)    return `${ms}ms`;
  if (ms < 60_000)  return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

const TYPE_ICON: Record<string, string> = {
  DOCUMENT:          '📄',
  CODE:              '💻',
  TEST_PLAN:         '🧪',
  DEPLOYMENT_SCRIPT: '🚀',
  REVIEW_REPORT:     '📋',
  CUSTOM:            '📦',
};

export function TaskDetailPanel({ task, artifacts, onClose, className }: TaskDetailPanelProps) {
  if (!task) return null;

  const taskArtifacts = artifacts ?? [];

  return (
    <div
      className={cn(
        'w-80 flex-shrink-0 rounded-xl border border-border-subtle bg-bg-surface overflow-y-auto',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-border-subtle">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{task.phaseName}</h3>
          <p className="text-xs text-text-secondary mt-0.5">{task.agentName}</p>
        </div>
        <button
          onClick={onClose}
          className="text-text-disabled hover:text-text-primary transition-colors ml-2 text-lg"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* Status row */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary">Status</span>
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant(task.status)}>{task.status}</Badge>
            {task.isAtRisk && (
              <Badge variant="warning">⚠ At Risk</Badge>
            )}
            {task.isCriticalPath && (
              <Badge variant="info">Critical Path</Badge>
            )}
          </div>
        </div>

        {/* Agent role */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary">Agent role</span>
          <span className="text-xs text-text-primary font-mono">
            {task.agentRole.replace('_AGENT', '')}
          </span>
        </div>

        {/* Elapsed time */}
        {task.elapsedMs != null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">Elapsed</span>
            <span className="text-xs tabular-nums text-text-primary">
              {formatMs(task.elapsedMs)}
            </span>
          </div>
        )}

        {/* Start time */}
        {task.startedAt && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">Started</span>
            <span className="text-xs text-text-secondary">
              {new Date(task.startedAt).toLocaleTimeString()}
            </span>
          </div>
        )}

        {/* At-risk warning */}
        {task.isAtRisk && (
          <div className="px-3 py-2 rounded-md bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.2)]">
            <p className="text-xs text-status-warning">
              ⚠ This task has been running longer than the configured threshold. 
              Check agent logs or consider cancelling.
            </p>
          </div>
        )}

        {/* Artifacts */}
        {taskArtifacts.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-text-secondary mb-2">
              Artifacts ({taskArtifacts.length})
            </p>
            <div className="space-y-2">
              {taskArtifacts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start gap-2 px-3 py-2 rounded-lg bg-bg-elevated border border-border-subtle"
                >
                  <span className="text-base flex-shrink-0" title={a.artifactType}>
                    {TYPE_ICON[a.artifactType.toUpperCase()] ?? '📦'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-text-primary truncate">{a.name}</p>
                    <p className="text-[10px] text-text-disabled truncate">{a.contentRef}</p>
                    <p className="text-[10px] text-text-disabled mt-0.5">
                      {new Date(a.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {taskArtifacts.length === 0 && task.status === 'DONE' && (
          <p className="text-xs text-text-disabled">No artifacts produced.</p>
        )}

        {taskArtifacts.length === 0 && task.status !== 'DONE' && (
          <p className="text-xs text-text-disabled italic">
            Artifacts will appear here when the task completes.
          </p>
        )}

        {/* Task ID (dev reference) */}
        <div className="pt-2 border-t border-border-subtle">
          <p className="text-[10px] text-text-disabled font-mono break-all">ID: {task.id}</p>
        </div>
      </div>
    </div>
  );
}
