/**
 * ApprovalGateUI — Approve/reject/rerun buttons with feedback textarea.
 * Used in the EpicRun detail view for human-in-the-loop approval gates.
 */
import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge, statusToVariant } from '@/components/ui/Badge';
import { TokenUsageBadge } from './TokenUsageBadge';
import { FileUploadHandler } from './FileUploadHandler';
import type { EpicRunStepStatus } from '../api/workspace.service';
import { tokenUsageApi, epicRunsExtendedApi } from '../api/workspace.service';

export interface ApprovalGateUIProps {
  stepId: string;
  stepOrder: number;
  agentName: string;
  status: EpicRunStepStatus;
  output?: string | null;
  feedback?: string | null;
  epicRunId?: string;
  onApprove?: (stepId: string) => void;
  onReject?: (stepId: string, feedback: string) => void;
  onRerun?: (stepId: string, context?: string) => void;
  onRequestUpdate?: (stepId: string) => void;
  loading?: boolean;
  className?: string;
}

export function ApprovalGateUI({
  stepId,
  stepOrder,
  agentName,
  status,
  output,
  feedback: existingFeedback,
  epicRunId,
  onApprove,
  onReject,
  onRerun,
  onRequestUpdate,
  loading = false,
  className,
}: ApprovalGateUIProps) {
  const { id: projectId } = useParams<{ id: string }>();
  const [feedbackText, setFeedbackText] = useState('');
  const [rerunContext, setRerunContext] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showRerunForm, setShowRerunForm] = useState(false);
  const [showRequestUpdateForm, setShowRequestUpdateForm] = useState(false);
  const [updateReason, setUpdateReason] = useState('');
  const [updateContext, setUpdateContext] = useState('');
  const [stepTokens, setStepTokens] = useState<number | null>(null);

  const handleApprove = useCallback(() => {
    onApprove?.(stepId);
  }, [stepId, onApprove]);

  const handleReject = useCallback(() => {
    if (!feedbackText.trim()) return;
    onReject?.(stepId, feedbackText.trim());
    setFeedbackText('');
    setShowRejectForm(false);
  }, [stepId, feedbackText, onReject]);

  const handleRerun = useCallback(() => {
    onRerun?.(stepId, rerunContext.trim() || undefined);
    setRerunContext('');
    setShowRerunForm(false);
  }, [stepId, rerunContext, onRerun]);

  const handleRequestUpdate = useCallback(async () => {
    if (!projectId || !epicRunId) return;
    try {
      await epicRunsExtendedApi.requestUpdate(projectId, epicRunId, stepId, {
        reason: updateReason.trim() || undefined,
        context: updateContext.trim() || undefined,
      });
      setShowRequestUpdateForm(false);
      setUpdateReason('');
      setUpdateContext('');
      onRequestUpdate?.(stepId);
    } catch {
      // Error handling — silently fail for now
    }
  }, [projectId, epicRunId, stepId, updateReason, updateContext, onRequestUpdate]);

  // Fetch step token usage
  useEffect(() => {
    if (!projectId || !stepId) return;
    tokenUsageApi.stepUsage(projectId, stepId)
      .then((data) => setStepTokens(data.totalInputTokens + data.totalOutputTokens))
      .catch(() => setStepTokens(null));
  }, [projectId, stepId]);

  const canApprove = status === 'completed';
  const canReject = status === 'completed';
  const canRerun = status === 'rejected' || status === 'failed';
  const canRequestUpdate = status === 'approved';

  return (
    <div className={cn('rounded-xl bg-bg-surface border border-border-subtle p-4', className)}>
      {/* Step header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-bg-elevated flex items-center justify-center text-xs font-medium text-text-secondary">
            {stepOrder}
          </span>
          <span className="text-sm font-medium text-text-primary">{agentName}</span>
          <TokenUsageBadge tokens={stepTokens} />
        </div>
        <Badge variant={statusToVariant(status)}>{status}</Badge>
      </div>

      {/* Output preview */}
      {output && (
        <div className="mb-3 p-3 rounded-lg bg-bg-elevated text-xs text-text-secondary font-mono max-h-32 overflow-y-auto">
          {output}
        </div>
      )}

      {/* Existing feedback (from previous rejection) */}
      {existingFeedback && (
        <div className="mb-3 p-3 rounded-lg bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.15)]">
          <p className="text-[11px] font-medium text-status-danger mb-1">Previous feedback:</p>
          <p className="text-xs text-text-secondary">{existingFeedback}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {canApprove && (
          <Button size="sm" onClick={handleApprove} loading={loading} disabled={loading}>
            Approve
          </Button>
        )}
        {canReject && !showRejectForm && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowRejectForm(true)}
            disabled={loading}
          >
            Reject
          </Button>
        )}
        {canRerun && !showRerunForm && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowRerunForm(true)}
            disabled={loading}
          >
            Rerun
          </Button>
        )}
        {canRequestUpdate && !showRequestUpdateForm && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowRequestUpdateForm(true)}
            disabled={loading}
          >
            Request Update
          </Button>
        )}
      </div>

      {/* Reject form */}
      {showRejectForm && (
        <div className="mt-3 space-y-2">
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Provide feedback explaining why this step is rejected..."
            className={cn(
              'w-full min-h-[80px] p-3 rounded-lg text-sm',
              'bg-bg-elevated border border-border-subtle text-text-primary',
              'placeholder:text-text-secondary/50',
              'focus:outline-none focus:ring-2 focus:ring-status-danger focus:border-status-danger',
              'resize-y',
            )}
            aria-label="Rejection feedback"
          />
          <FileUploadHandler onContent={(text) => setFeedbackText(text)} />
          <div className="flex items-center gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={handleReject}
              disabled={!feedbackText.trim() || loading}
              loading={loading}
            >
              Submit Rejection
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowRejectForm(false);
                setFeedbackText('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Rerun form */}
      {showRerunForm && (
        <div className="mt-3 space-y-2">
          <textarea
            value={rerunContext}
            onChange={(e) => setRerunContext(e.target.value)}
            placeholder="Optional: provide additional context for the rerun..."
            className={cn(
              'w-full min-h-[80px] p-3 rounded-lg text-sm',
              'bg-bg-elevated border border-border-subtle text-text-primary',
              'placeholder:text-text-secondary/50',
              'focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-accent-primary',
              'resize-y',
            )}
            aria-label="Rerun context"
          />
          <FileUploadHandler onContent={(text) => setRerunContext(text)} />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleRerun} loading={loading} disabled={loading}>
              Rerun Step
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowRerunForm(false);
                setRerunContext('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Request Update form */}
      {showRequestUpdateForm && (
        <div className="mt-3 space-y-2">
          <textarea
            value={updateReason}
            onChange={(e) => setUpdateReason(e.target.value)}
            placeholder="Reason for requesting an update..."
            className={cn(
              'w-full min-h-[60px] p-3 rounded-lg text-sm',
              'bg-bg-elevated border border-border-subtle text-text-primary',
              'placeholder:text-text-secondary/50',
              'focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-accent-primary',
              'resize-y',
            )}
            aria-label="Update reason"
          />
          <textarea
            value={updateContext}
            onChange={(e) => setUpdateContext(e.target.value)}
            placeholder="Optional: additional context for the agent..."
            className={cn(
              'w-full min-h-[60px] p-3 rounded-lg text-sm',
              'bg-bg-elevated border border-border-subtle text-text-primary',
              'placeholder:text-text-secondary/50',
              'focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-accent-primary',
              'resize-y',
            )}
            aria-label="Update context"
          />
          <FileUploadHandler onContent={(text) => setUpdateContext(text)} />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleRequestUpdate} loading={loading} disabled={loading}>
              Submit Request
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowRequestUpdateForm(false);
                setUpdateReason('');
                setUpdateContext('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
