/**
 * EpicRunDetail — Displays pipeline steps with current status,
 * approval controls, execution history, and live WebSocket updates.
 * Route: /projects/:id/workspace/runs/:runId
 */
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@/lib/hooks';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge, statusToVariant } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ApprovalGateUI } from '../components/ApprovalGateUI';
import { useWorkspaceSocket } from '../hooks/useWorkspaceSocket';
import { epicRunsApi, type EpicRunHistoryEntry } from '../api/workspace.service';
import { useState, useCallback, useEffect } from 'react';

export function EpicRunDetail() {
  const { id: projectId, runId } = useParams<{ id: string; runId: string }>();
  const navigate = useNavigate();

  const { data: epicRun, loading, refetch } = useQuery(
    () => epicRunsApi.getById(projectId!, runId!),
    [projectId, runId],
  );

  const { data: history, refetch: refetchHistory } = useQuery(
    () => epicRunsApi.history(projectId!, runId!),
    [projectId, runId],
  );

  // Subscribe to live updates
  const { lastEpicRunProgress } = useWorkspaceSocket({ projectId: projectId! });

  // Refetch when we get a progress event for this run
  useEffect(() => {
    if (lastEpicRunProgress?.epicRunId === runId) {
      refetch();
      refetchHistory();
    }
  }, [lastEpicRunProgress, runId, refetch, refetchHistory]);

  const [actionLoading, setActionLoading] = useState(false);

  const handleApprove = useCallback(
    async (stepId: string) => {
      if (!projectId || !runId) return;
      setActionLoading(true);
      try {
        await epicRunsApi.approveStep(projectId, runId, stepId);
        refetch();
        refetchHistory();
      } finally {
        setActionLoading(false);
      }
    },
    [projectId, runId, refetch, refetchHistory],
  );

  const handleReject = useCallback(
    async (stepId: string, feedback: string) => {
      if (!projectId || !runId) return;
      setActionLoading(true);
      try {
        await epicRunsApi.rejectStep(projectId, runId, stepId, feedback);
        refetch();
        refetchHistory();
      } finally {
        setActionLoading(false);
      }
    },
    [projectId, runId, refetch, refetchHistory],
  );

  const handleRerun = useCallback(
    async (stepId: string, context?: string) => {
      if (!projectId || !runId) return;
      setActionLoading(true);
      try {
        await epicRunsApi.rerunStep(projectId, runId, stepId, context);
        refetch();
        refetchHistory();
      } finally {
        setActionLoading(false);
      }
    },
    [projectId, runId, refetch, refetchHistory],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!epicRun) {
    return (
      <EmptyState
        title="Epic run not found"
        description="The requested epic run could not be loaded."
        action={
          <Button size="sm" onClick={() => navigate(`/projects/${projectId}/workspace`)}>
            Back to Workspace
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Epic Run`}
        description={`Pipeline execution — ${epicRun.steps.length} steps`}
        breadcrumbs={[
          { label: 'Projects' },
          { label: 'Workspace' },
          { label: 'Runs' },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <Badge variant={statusToVariant(epicRun.status)}>{epicRun.status}</Badge>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/projects/${projectId}/workspace`)}
            >
              ← Back
            </Button>
          </div>
        }
      />

      {/* Pipeline steps */}
      <section>
        <h2 className="text-[13px] font-medium text-text-secondary uppercase tracking-wide mb-3">
          Pipeline Steps
        </h2>
        <div className="space-y-3">
          {epicRun.steps
            .sort((a, b) => a.stepOrder - b.stepOrder)
            .map((step) => (
              <ApprovalGateUI
                key={step.id}
                stepId={step.id}
                stepOrder={step.stepOrder}
                agentName={step.agentProfileId}
                status={step.status}
                output={step.output}
                feedback={step.feedback}
                onApprove={handleApprove}
                onReject={handleReject}
                onRerun={handleRerun}
                loading={actionLoading}
              />
            ))}
        </div>
      </section>

      {/* Execution history timeline */}
      <section>
        <h2 className="text-[13px] font-medium text-text-secondary uppercase tracking-wide mb-3">
          Execution History
        </h2>
        {!history || history.length === 0 ? (
          <p className="text-sm text-text-secondary">No history entries yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map((entry: EpicRunHistoryEntry) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-bg-surface border border-border-subtle"
              >
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-bg-elevated flex items-center justify-center text-xs font-medium text-text-secondary">
                  {entry.stepOrder}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={statusToVariant(entry.action)}>{entry.action}</Badge>
                    {entry.actor && (
                      <span className="text-xs text-text-secondary">{entry.actor}</span>
                    )}
                  </div>
                  <p className="text-xs text-text-disabled mt-1">
                    {new Date(entry.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
