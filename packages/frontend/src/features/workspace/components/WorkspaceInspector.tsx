/**
 * WorkspaceInspector — UI panel that calls workspaceApi.inspect()
 * and displays the result using InspectorOutput.
 * Shows loading state while inspecting.
 */
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { InspectorOutput } from './InspectorOutput';
import { workspaceApi, type InspectResult } from '../api/workspace.service';

interface WorkspaceInspectorProps {
  projectId: string;
  onClose?: () => void;
}

export function WorkspaceInspector({ projectId, onClose }: WorkspaceInspectorProps) {
  const [result, setResult] = useState<InspectResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInspect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await workspaceApi.inspect(projectId);
      setResult(data);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to inspect workspace');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-primary">Workspace Inspector</h3>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleInspect} loading={loading}>
            {result ? 'Re-inspect' : 'Inspect'}
          </Button>
          {onClose && (
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="text-sm text-status-danger bg-[rgba(239,68,68,0.1)] px-3 py-2 rounded-md">
          {error}
        </div>
      )}

      <InspectorOutput result={result} loading={loading} />
    </div>
  );
}
