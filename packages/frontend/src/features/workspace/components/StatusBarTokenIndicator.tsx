/**
 * StatusBarTokenIndicator — Shows today's estimated cost in the header area.
 * Clicking opens the TokenUsageReportPanel.
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { tokenUsageApi } from '../api/workspace.service';
import { TokenUsageReportPanel } from './TokenUsageReportPanel';

export function StatusBarTokenIndicator() {
  const { id: projectId } = useParams<{ id: string }>();
  const [cost, setCost] = useState<number | null>(null);
  const [showPanel, setShowPanel] = useState(false);

  const fetchToday = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await tokenUsageApi.today(projectId);
      setCost(data.estimatedCost);
    } catch {
      setCost(null);
    }
  }, [projectId]);

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  const formatted = cost !== null ? `$${cost.toFixed(2)}` : '—';

  return (
    <>
      <button
        type="button"
        onClick={() => setShowPanel(true)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
        title="Today's token cost — click for details"
      >
        <span aria-hidden="true">💰</span>
        <span>{formatted}</span>
      </button>

      {showPanel && (
        <TokenUsageReportPanel onClose={() => setShowPanel(false)} />
      )}
    </>
  );
}
