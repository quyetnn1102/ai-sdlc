/**
 * LoadDemoDialog — Confirmation dialog for loading the demo project.
 * Shows merge/replace option if workspace already exists.
 */
import { useState, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { demoApi } from '../../api/workspace.service';
import { useQuery } from '@/lib/hooks';

interface LoadDemoDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onSuccess?: () => void;
}

export function LoadDemoDialog({ open, onClose, projectId, onSuccess }: LoadDemoDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: demoStatus } = useQuery(
    open ? () => demoApi.status(projectId) : null,
    [projectId, open],
  );

  const alreadyLoaded = demoStatus?.loaded ?? false;

  const handleLoad = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await demoApi.load(projectId);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load demo');
    } finally {
      setLoading(false);
    }
  }, [projectId, onSuccess, onClose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Load Demo Project"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleLoad} loading={loading}>
            {alreadyLoaded ? 'Replace & Load' : 'Load Demo'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="text-sm text-status-danger bg-[rgba(239,68,68,0.1)] px-3 py-2 rounded-md">
            {error}
          </div>
        )}

        <p className="text-sm text-text-secondary">
          This will load a complete SDLC demo workspace with:
        </p>
        <ul className="text-sm text-text-secondary space-y-1 list-disc list-inside">
          <li>4 agents (BA, Dev, QA, DevOps)</li>
          <li>Pre-configured skills for each agent</li>
          <li>A full SDLC pipeline</li>
          <li>6 sample epic work items</li>
          <li>Slash commands</li>
        </ul>

        {alreadyLoaded && (
          <div className="rounded-lg bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.2)] p-3">
            <p className="text-xs text-status-warning">
              ⚠ A demo workspace is already loaded. Loading again will replace the existing configuration.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
