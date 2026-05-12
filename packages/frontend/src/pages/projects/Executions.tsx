/**
 * Executions page — Workflow Execution Dashboard
 *
 * Spec requirements covered:
 *  Req 8.1  — real-time dashboard showing task states
 *  Req 8.2  — DAG visualization with colour-coded nodes
 *  Req 8.3  — at-risk task highlighting
 *  Req 8.4  — overall progress percentage
 *  Req 8.5  — critical path highlighted
 *  Req 9.1  — Start Workflow with config dialog
 *  Req 9.2  — Pause control
 *  Req 9.3  — Resume control
 *  Req 9.4  — Cancel control
 *  Req 7.5  — consolidated artifact view grouped by phase
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@/lib/hooks';
import {
  executionsService,
  type WorkflowExecution,
  type WorkflowExecutionSummary,
  type ArtifactsByPhase,
} from '@/services/executions.service';
import type { DagData, DagTask } from '@/components/dag/DagVisualization';
import { DagVisualization } from '@/components/dag/DagVisualization';
import { TaskDetailPanel } from '@/components/dag/TaskDetailPanel';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, MetricCard } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { StaticTabs } from '@/components/ui/Tabs';
import { ApiError } from '@/lib/api';

// ── Status helpers ───────────────────────────────────────────────────────

type BV = 'success' | 'danger' | 'warning' | 'pending' | 'info' | 'neutral';

function execBadge(s: string): BV {
  if (s === 'COMPLETED')              return 'success';
  if (s === 'FAILED')                 return 'danger';
  if (s === 'RUNNING')                return 'info';
  if (s === 'PAUSED')                 return 'warning';
  if (s === 'BLOCKED')                return 'danger';
  if (['CANCELLED'].includes(s))      return 'neutral';
  return 'pending';
}

const ACTIVE_STATUSES = new Set(['RUNNING', 'PAUSED']);

// ── Execution row (list view) ────────────────────────────────────────────

function ExecutionRow({
  summary,
  onClick,
}: {
  summary: WorkflowExecutionSummary;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl bg-bg-surface border border-border-subtle hover:border-border-default transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant={execBadge(summary.status)}>{summary.status}</Badge>
          <span className="text-sm text-text-secondary">{summary._count.tasks} tasks</span>
        </div>
        <span className="text-xs text-text-disabled">
          {new Date(summary.createdAt).toLocaleString()}
        </span>
      </div>
      {summary.startedAt && (
        <p className="text-xs text-text-secondary mt-1.5">
          Started {new Date(summary.startedAt).toLocaleString()}
          {summary.completedAt &&
            ` · Finished ${new Date(summary.completedAt).toLocaleString()}`}
        </p>
      )}
    </button>
  );
}

// ── Artifact phase group ─────────────────────────────────────────────────

const ARTIFACT_ICON: Record<string, string> = {
  DOCUMENT:          '📄',
  CODE:              '💻',
  TEST_PLAN:         '🧪',
  DEPLOYMENT_SCRIPT: '🚀',
  REVIEW_REPORT:     '📋',
  CUSTOM:            '📦',
};

function ArtifactGroup({ group }: { group: ArtifactsByPhase['byPhase'][0] }) {
  return (
    <div>
      <h3 className="text-[11px] uppercase tracking-wide text-text-secondary mb-2">
        {group.phaseName} ({group.artifacts.length})
      </h3>
      <div className="space-y-2">
        {group.artifacts.map((a) => (
          <div
            key={a.id}
            className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-bg-elevated border border-border-subtle"
          >
            <span className="text-base flex-shrink-0" title={a.artifactType}>
              {ARTIFACT_ICON[a.artifactType?.toUpperCase()] ?? '📦'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary truncate">{a.name}</p>
              <p className="text-[11px] text-text-disabled truncate mt-0.5">{a.contentRef}</p>
            </div>
            <span className="text-[10px] text-text-disabled flex-shrink-0 mt-0.5">
              {new Date(a.createdAt).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Execution detail ─────────────────────────────────────────────────────

function ExecutionDetail({
  executionId,
  projectId,
  onBack,
}: {
  executionId: string;
  projectId: string;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<'dag' | 'tasks' | 'artifacts'>('dag');
  const [selectedTask, setSelectedTask] = useState<DagTask | null>(null);
  const [actionLoading, setActionLoading] = useState('');
  const [dagData, setDagData] = useState<DagData | null>(null);
  const [artifactsData, setArtifactsData] = useState<ArtifactsByPhase | null>(null);
  const [execution, setExecution] = useState<WorkflowExecution | null>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(true);

  const load = useCallback(async () => {
    try {
      const [ex, dag] = await Promise.all([
        executionsService.get(projectId, executionId),
        executionsService.getDag(projectId, executionId),
      ]);
      if (!activeRef.current) return;
      setExecution(ex);
      setDagData(dag);
    } catch {
      /* ignore transient errors during polling */
    } finally {
      setLoading(false);
    }
  }, [projectId, executionId]);

  const loadArtifacts = useCallback(async () => {
    try {
      const a = await executionsService.getArtifacts(projectId, executionId);
      if (activeRef.current) setArtifactsData(a);
    } catch { /* ignore */ }
  }, [projectId, executionId]);

  // Initial load
  useEffect(() => {
    activeRef.current = true;
    load();
    loadArtifacts();
    return () => { activeRef.current = false; };
  }, [load, loadArtifacts]);

  // Poll every 3s while active
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (execution && ACTIVE_STATUSES.has(execution.status)) {
        load();
        if (tab === 'artifacts') loadArtifacts();
      }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [execution, tab, load, loadArtifacts]);

  // Reload artifacts when switching to that tab
  useEffect(() => {
    if (tab === 'artifacts') loadArtifacts();
  }, [tab, loadArtifacts]);

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
      await load();
    } finally {
      setActionLoading('');
    }
  }

  if (loading && !execution) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (!execution) {
    return <p className="text-sm text-text-secondary py-8">Execution not found.</p>;
  }

  const progress   = dagData?.progress ?? execution.progress;
  const tasks      = execution.tasks ?? [];
  const done       = tasks.filter((t) => t.status === 'DONE').length;
  const running    = tasks.filter((t) => t.status === 'RUNNING').length;
  const failed     = tasks.filter((t) => ['FAILED', 'TIMED_OUT'].includes(t.status)).length;
  const atRisk     = tasks.filter((t) => t.isAtRisk).length;
  const total      = tasks.length;

  // Find artifacts for the selected task
  const selectedTaskArtifacts = selectedTask
    ? tasks.find((t) => t.id === selectedTask.id)?.artifacts ?? []
    : [];

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-text-secondary hover:text-text-primary text-sm transition-colors"
          >
            ← Back
          </button>
          <Badge variant={execBadge(execution.status)}>{execution.status}</Badge>
          {ACTIVE_STATUSES.has(execution.status) && (
            <Spinner size="sm" />
          )}
          <span className="text-xs text-text-secondary">
            Started {execution.startedAt
              ? new Date(execution.startedAt).toLocaleString()
              : '—'}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {execution.status === 'RUNNING' && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => doAction('pause')}
              loading={actionLoading === 'pause'}
            >
              ⏸ Pause
            </Button>
          )}
          {execution.status === 'PAUSED' && (
            <Button
              size="sm"
              onClick={() => doAction('resume')}
              loading={actionLoading === 'resume'}
            >
              ▶ Resume
            </Button>
          )}
          {ACTIVE_STATUSES.has(execution.status) && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => doAction('cancel')}
              loading={actionLoading === 'cancel'}
            >
              ✕ Cancel
            </Button>
          )}
        </div>
      </div>

      {/* BLOCKED warning */}
      {execution.status === 'BLOCKED' && (
        <div className="px-4 py-3 rounded-xl bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)]">
          <p className="text-sm text-status-danger font-medium">Execution Blocked</p>
          <p className="text-xs text-text-secondary mt-1">
            No agent profiles could be resolved for the required workflow phases.
            Configure phase-to-agent mappings and try again.
          </p>
        </div>
      )}

      {/* Metric strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard label="Total Tasks"  value={total} />
        <MetricCard label="Done"         value={done} />
        <MetricCard label="Running"      value={running} />
        <MetricCard label="Failed"       value={failed} />
        <MetricCard label="At Risk ⚠"   value={atRisk} />
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-text-secondary">
          <span>Overall progress</span>
          <span className="tabular-nums font-semibold text-text-primary">
            {progress.percentage}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-bg-elevated overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress.percentage}%`,
              backgroundColor:
                failed > 0
                  ? '#EF4444'
                  : execution.status === 'COMPLETED'
                  ? '#22C55E'
                  : '#4F6EF7',
            }}
          />
        </div>
      </div>

      {/* Tab bar */}
      <StaticTabs
        tabs={[
          { key: 'dag',       label: 'DAG View' },
          { key: 'tasks',     label: `Tasks (${total})` },
          { key: 'artifacts', label: `Artifacts (${artifactsData?.totalArtifacts ?? '…'})` },
        ]}
        active={tab}
        onChange={(k) => setTab(k as 'dag' | 'tasks' | 'artifacts')}
      />

      {/* ── DAG Tab ─────────────────────────────────────────────────── */}
      {tab === 'dag' && (
        <div className="flex gap-4 items-start">
          <div className="flex-1 min-w-0">
            {dagData ? (
              <DagVisualization
                data={dagData}
                onTaskClick={setSelectedTask}
              />
            ) : (
              <div className="flex items-center justify-center py-12">
                <Spinner />
              </div>
            )}
          </div>

          {/* Task detail side panel */}
          {selectedTask && (
            <TaskDetailPanel
              task={selectedTask}
              artifacts={selectedTaskArtifacts}
              onClose={() => setSelectedTask(null)}
            />
          )}
        </div>
      )}

      {/* ── Tasks Tab ───────────────────────────────────────────────── */}
      {tab === 'tasks' && (
        <div className="rounded-xl bg-bg-surface border border-border-subtle overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default">
                {['Phase', 'Agent', 'Status', 'Elapsed', 'Retries', 'Flags'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 h-10 text-[11px] uppercase tracking-wide text-text-secondary font-medium"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-text-secondary">
                    No tasks yet.
                  </td>
                </tr>
              ) : tasks.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-border-subtle last:border-0 hover:bg-bg-hover transition-colors cursor-pointer"
                  onClick={() => setSelectedTask(t as unknown as DagTask)}
                >
                  <td className="px-4 h-11 text-sm font-medium text-text-primary">
                    {t.phaseName}
                  </td>
                  <td className="px-4 h-11 text-sm text-text-secondary">
                    {t.agentProfile.name}
                  </td>
                  <td className="px-4 h-11">
                    <Badge
                      variant={
                        t.status === 'DONE'
                          ? 'success'
                          : ['FAILED', 'TIMED_OUT'].includes(t.status)
                          ? 'danger'
                          : t.status === 'RUNNING'
                          ? 'info'
                          : t.status === 'STARTING'
                          ? 'warning'
                          : 'pending'
                      }
                    >
                      {t.status}
                    </Badge>
                  </td>
                  <td className="px-4 h-11 text-sm tabular-nums text-text-secondary">
                    {t.elapsedMs != null
                      ? t.elapsedMs < 60_000
                        ? `${Math.round(t.elapsedMs / 1000)}s`
                        : `${Math.round(t.elapsedMs / 60_000)}m`
                      : '—'}
                  </td>
                  <td className="px-4 h-11 text-sm tabular-nums text-text-secondary">
                    {t.retryCount > 0 ? (
                      <Badge variant="warning">{t.retryCount}</Badge>
                    ) : (
                      <span className="text-text-disabled">0</span>
                    )}
                  </td>
                  <td className="px-4 h-11">
                    <div className="flex gap-1">
                      {t.isAtRisk && <Badge variant="warning">⚠ At Risk</Badge>}
                      {t.error && (
                        <Badge variant="danger" className="max-w-[140px] truncate">
                          {t.error}
                        </Badge>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Artifacts Tab ────────────────────────────────────────────── */}
      {tab === 'artifacts' && (
        <>
          {!artifactsData ? (
            <div className="flex items-center justify-center py-12"><Spinner /></div>
          ) : artifactsData.totalArtifacts === 0 ? (
            <EmptyState
              title="No artifacts yet"
              description="Artifacts will appear here as agents complete their tasks."
            />
          ) : (
            <div className="space-y-6">
              {artifactsData.byPhase.map((group) => (
                <ArtifactGroup key={group.phaseId} group={group} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Start Execution config dialog ─────────────────────────────────────────

interface StartConfig {
  maxConcurrency: string;
  heartbeatIntervalSec: string;
  taskTimeoutSec: string;
  maxRetries: string;
  atRiskThresholdSec: string;
}

function StartDialog({
  open,
  onClose,
  onStart,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onStart: (cfg: Record<string, number>) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<StartConfig>({
    maxConcurrency:      '5',
    heartbeatIntervalSec: '30',
    taskTimeoutSec:       '600',
    maxRetries:           '2',
    atRiskThresholdSec:   '300',
  });

  function handleStart(e: React.FormEvent) {
    e.preventDefault();
    onStart({
      maxConcurrency:       Number(form.maxConcurrency),
      heartbeatIntervalSec: Number(form.heartbeatIntervalSec),
      taskTimeoutSec:       Number(form.taskTimeoutSec),
      maxRetries:           Number(form.maxRetries),
      atRiskThresholdSec:   Number(form.atRiskThresholdSec),
    });
  }

  const f = (key: keyof StartConfig, label: string, help: string) => (
    <div>
      <Input
        label={label}
        type="number"
        min={1}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
      <p className="text-[11px] text-text-disabled mt-1">{help}</p>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Start Workflow Execution"
      description="Configure the orchestration parameters before launching."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button form="start-execution-form" type="submit" loading={loading}>
            ▶ Start Workflow
          </Button>
        </>
      }
    >
      <form id="start-execution-form" onSubmit={handleStart} className="space-y-4">
        {f('maxConcurrency',      'Max Concurrency',          'Max agent tasks running in parallel (default 5, max 10)')}
        {f('heartbeatIntervalSec','Heartbeat Interval (sec)', 'How often agents send a heartbeat (default 30s)')}
        {f('taskTimeoutSec',      'Task Timeout (sec)',        'Max time before a task is forcibly failed (default 600s)')}
        {f('maxRetries',          'Max Retries',              'How many times to retry a failed task (default 2)')}
        {f('atRiskThresholdSec',  'At-Risk Threshold (sec)',  'Flag tasks running longer than this as "at risk" (default 300s)')}
      </form>
    </Modal>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export function ExecutionsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { data: summaries, loading: listLoading, refetch } = useQuery(
    () => executionsService.list(projectId!),
    [projectId],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [startOpen, setStartOpen]   = useState(false);
  const [starting, setStarting]     = useState(false);
  const [startError, setStartError] = useState('');

  async function handleStart(config: Record<string, number>) {
    setStarting(true);
    setStartError('');
    try {
      const ex = await executionsService.start(projectId!, config);
      setStartOpen(false);
      setSelectedId(ex.id);
      refetch();
    } catch (err) {
      setStartError(err instanceof ApiError ? err.message : 'Failed to start workflow');
    } finally {
      setStarting(false);
    }
  }

  // Detail view
  if (selectedId) {
    return (
      <ExecutionDetail
        executionId={selectedId}
        projectId={projectId!}
        onBack={() => { setSelectedId(null); refetch(); }}
      />
    );
  }

  // List view
  return (
    <div>
      <PageHeader
        title="Workflow Executions"
        description="Run the agent-based SDLC workflow. Agents execute in parallel across phases."
        actions={
          <Button onClick={() => setStartOpen(true)}>▶ Start Workflow</Button>
        }
      />

      {startError && (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] text-sm text-status-danger">
          {startError}
        </div>
      )}

      {listLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner />
        </div>
      ) : !summaries?.length ? (
        <EmptyState
          title="No executions yet"
          description="Start a workflow to let agents automatically execute each SDLC phase in order, with independent phases running in parallel."
          action={<Button onClick={() => setStartOpen(true)}>▶ Start Workflow</Button>}
        />
      ) : (
        <div className="space-y-3">
          {summaries.map((s) => (
            <ExecutionRow key={s.id} summary={s} onClick={() => setSelectedId(s.id)} />
          ))}
        </div>
      )}

      <StartDialog
        open={startOpen}
        onClose={() => setStartOpen(false)}
        onStart={handleStart}
        loading={starting}
      />
    </div>
  );
}
