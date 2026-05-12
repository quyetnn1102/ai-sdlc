import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@/lib/hooks';
import {
  executionsService,
  type WorkflowExecution,
  type WorkflowExecutionSummary,
  type TaskStatus,
} from '@/services/executions.service';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, MetricCard } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { ApiError } from '@/lib/api';

// ── Status helpers ──────────────────────────────────────────────────────
type BV = 'success' | 'danger' | 'warning' | 'pending' | 'info' | 'neutral';
function execBadge(s: string): BV {
  if (['COMPLETED'].includes(s)) return 'success';
  if (['FAILED'].includes(s))    return 'danger';
  if (['RUNNING'].includes(s))   return 'info';
  if (['PAUSED'].includes(s))    return 'warning';
  if (['CANCELLED'].includes(s)) return 'neutral';
  return 'pending';
}
function taskBadge(s: TaskStatus): BV {
  if (s === 'DONE')              return 'success';
  if (['FAILED', 'TIMED_OUT'].includes(s)) return 'danger';
  if (s === 'RUNNING')           return 'info';
  if (s === 'STARTING')          return 'warning';
  if (s === 'SKIPPED')           return 'neutral';
  return 'pending';
}

// ── DAG visualisation (simple linear list with dependency arrows) ───────
function TaskNode({ task, allTasks }: {
  task: WorkflowExecution['tasks'][0];
  allTasks: WorkflowExecution['tasks'];
}) {
  const depNames = task.dependencies
    .map((d) => allTasks.find((t) => t.id === d.dependsOnTaskId)?.phaseName)
    .filter(Boolean);

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-bg-elevated border border-border-subtle">
      {/* Status indicator */}
      <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${
        task.status === 'DONE'    ? 'bg-status-success' :
        task.status === 'RUNNING' ? 'bg-status-info animate-pulse' :
        task.status === 'FAILED'  ? 'bg-status-danger' :
        task.status === 'STARTING'? 'bg-status-warning animate-pulse' :
        'bg-[rgba(255,255,255,0.2)]'
      }`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-text-primary">{task.phaseName}</span>
          <Badge variant={taskBadge(task.status)} className="text-[10px]">{task.status}</Badge>
        </div>
        <p className="text-xs text-text-secondary mt-0.5">{task.agentProfile.name}</p>
        {depNames.length > 0 && (
          <p className="text-[11px] text-text-disabled mt-1">↳ depends on: {depNames.join(', ')}</p>
        )}
        {task.durationMs != null && (
          <p className="text-[11px] text-text-disabled mt-0.5">
            Duration: {(task.durationMs / 1000).toFixed(1)}s
          </p>
        )}
        {task.error && (
          <p className="text-[11px] text-status-danger mt-1">{task.error}</p>
        )}
        {task.artifacts.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {task.artifacts.map((a) => (
              <Badge key={a.id} variant="info" className="text-[10px]">{a.name}</Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Execution detail panel ───────────────────────────────────────────────
function ExecutionDetail({ executionId, projectId, onClose }: {
  executionId: string;
  projectId: string;
  onClose: () => void;
}) {
  const [execution, setExecution] = useState<WorkflowExecution | null>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [actionLoading, setActionLoading] = useState('');

  async function load() {
    try {
      const data = await executionsService.get(projectId, executionId);
      setExecution(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  // Poll every 3s while execution is active
  useEffect(() => {
    load();
    pollRef.current = setInterval(() => {
      if (execution?.status === 'RUNNING' || execution?.status === 'PAUSED') {
        load();
      }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [executionId]);

  async function doAction(action: 'pause' | 'resume' | 'cancel') {
    setActionLoading(action);
    try {
      const fn = {
        pause:  () => executionsService.pause(projectId, executionId),
        resume: () => executionsService.resume(projectId, executionId),
        cancel: () => executionsService.cancel(projectId, executionId),
      }[action];
      const updated = await fn();
      setExecution(updated);
    } finally { setActionLoading(''); }
  }

  if (loading) return <div className="flex items-center justify-center py-12"><Spinner /></div>;
  if (!execution) return <p className="text-sm text-text-secondary">Execution not found.</p>;

  const tasks = execution.tasks ?? [];
  const done    = tasks.filter((t) => t.status === 'DONE').length;
  const failed  = tasks.filter((t) => t.status === 'FAILED').length;
  const running = tasks.filter((t) => t.status === 'RUNNING').length;
  const total   = tasks.length;
  const pct     = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant={execBadge(execution.status)}>{execution.status}</Badge>
          <span className="text-xs text-text-secondary">
            Started {execution.startedAt ? new Date(execution.startedAt).toLocaleString() : '—'}
          </span>
        </div>
        <div className="flex gap-2">
          {execution.status === 'RUNNING' && (
            <Button size="sm" variant="secondary" onClick={() => doAction('pause')} loading={actionLoading === 'pause'}>Pause</Button>
          )}
          {execution.status === 'PAUSED' && (
            <Button size="sm" variant="primary" onClick={() => doAction('resume')} loading={actionLoading === 'resume'}>Resume</Button>
          )}
          {['RUNNING', 'PAUSED'].includes(execution.status) && (
            <Button size="sm" variant="danger" onClick={() => doAction('cancel')} loading={actionLoading === 'cancel'}>Cancel</Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClose}>← Back</Button>
        </div>
      </div>

      {/* Progress */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Total Tasks"   value={total} />
        <MetricCard label="Done"          value={done} />
        <MetricCard label="Running"       value={running} />
        <MetricCard label="Failed"        value={failed} />
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-text-secondary">
          <span>Progress</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-bg-elevated overflow-hidden">
          <div
            className="h-full rounded-full bg-accent-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* DAG / Task list */}
      <div>
        <h3 className="text-[11px] uppercase tracking-wide text-text-secondary mb-2">
          Tasks ({total})
        </h3>
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskNode key={task.id} task={task} allTasks={tasks} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────
export function ExecutionsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { data: executions, loading, refetch } = useQuery(
    () => executionsService.list(projectId!), [projectId],
  );
  const [starting, setStarting]     = useState(false);
  const [startError, setStartError] = useState('');
  const [selected, setSelected]     = useState<string | null>(null);

  async function handleStart() {
    setStarting(true);
    setStartError('');
    try {
      const ex = await executionsService.start(projectId!);
      setSelected(ex.id);
      refetch();
    } catch (err) {
      setStartError(err instanceof ApiError ? err.message : 'Failed to start workflow');
    } finally { setStarting(false); }
  }

  if (selected) {
    return (
      <div>
        <PageHeader title="Workflow Execution" />
        <ExecutionDetail
          executionId={selected}
          projectId={projectId!}
          onClose={() => { setSelected(null); refetch(); }}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Workflow Executions"
        description="Run the agent-based SDLC workflow. Agents execute in parallel where phases allow."
        actions={
          <Button onClick={handleStart} loading={starting}>▶ Start Workflow</Button>
        }
      />

      {startError && (
        <div className="mb-4 px-3 py-2 rounded-md bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-sm text-status-danger">
          {startError}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12"><Spinner /></div>
      ) : !executions?.length ? (
        <EmptyState
          title="No executions yet"
          description="Start a workflow to let agents autonomously execute each SDLC phase."
          action={<Button onClick={handleStart} loading={starting}>Start Workflow</Button>}
        />
      ) : (
        <div className="space-y-3">
          {executions.map((ex) => (
            <button
              key={ex.id}
              onClick={() => setSelected(ex.id)}
              className="w-full text-left p-4 rounded-xl bg-bg-surface border border-border-subtle hover:border-border-default transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant={execBadge(ex.status)}>{ex.status}</Badge>
                  <span className="text-sm text-text-secondary">
                    {ex._count.tasks} tasks
                  </span>
                </div>
                <span className="text-xs text-text-disabled">
                  {new Date(ex.createdAt).toLocaleString()}
                </span>
              </div>
              {ex.startedAt && (
                <p className="text-xs text-text-secondary mt-1">
                  Started {new Date(ex.startedAt).toLocaleString()}
                  {ex.completedAt && ` → Completed ${new Date(ex.completedAt).toLocaleString()}`}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
