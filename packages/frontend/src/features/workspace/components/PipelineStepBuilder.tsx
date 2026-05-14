/**
 * PipelineStepBuilder — List of pipeline steps with on-failure toggle
 * and reorder buttons. Supports drag-and-drop reordering.
 */
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export interface PipelineStepItem {
  id: string;
  agentName: string;
  agentProfileId: string;
  onFailure: 'stop' | 'continue';
}

export interface PipelineStepBuilderProps {
  steps: PipelineStepItem[];
  onStepsChange: (steps: PipelineStepItem[]) => void;
  className?: string;
}

export function PipelineStepBuilder({
  steps,
  onStepsChange,
  className,
}: PipelineStepBuilderProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleToggleOnFailure = useCallback(
    (index: number) => {
      const updated = [...steps];
      updated[index] = {
        ...updated[index],
        onFailure: updated[index].onFailure === 'stop' ? 'continue' : 'stop',
      };
      onStepsChange(updated);
    },
    [steps, onStepsChange],
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index === 0) return;
      const updated = [...steps];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      onStepsChange(updated);
    },
    [steps, onStepsChange],
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index === steps.length - 1) return;
      const updated = [...steps];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      onStepsChange(updated);
    },
    [steps, onStepsChange],
  );

  const handleRemove = useCallback(
    (index: number) => {
      const updated = steps.filter((_, i) => i !== index);
      onStepsChange(updated);
    },
    [steps, onStepsChange],
  );

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    // Visual feedback handled via CSS
    void index;
  }, []);

  const handleDrop = useCallback(
    (targetIndex: number) => {
      if (dragIndex === null || dragIndex === targetIndex) {
        setDragIndex(null);
        return;
      }
      const updated = [...steps];
      const [moved] = updated.splice(dragIndex, 1);
      updated.splice(targetIndex, 0, moved);
      onStepsChange(updated);
      setDragIndex(null);
    },
    [dragIndex, steps, onStepsChange],
  );

  return (
    <div className={cn('space-y-2', className)}>
      {steps.length === 0 && (
        <div className="text-center py-8 text-sm text-text-secondary border border-dashed border-border-subtle rounded-lg">
          No steps added. Add agents to build your pipeline.
        </div>
      )}

      {steps.map((step, index) => (
        <div
          key={step.id}
          draggable
          onDragStart={() => handleDragStart(index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDrop={() => handleDrop(index)}
          onDragEnd={() => setDragIndex(null)}
          className={cn(
            'flex items-center gap-3 p-3 rounded-lg bg-bg-surface border border-border-subtle',
            'transition-all duration-150 cursor-grab active:cursor-grabbing',
            'hover:border-border-default',
            dragIndex === index && 'opacity-50',
          )}
        >
          {/* Step number */}
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-bg-elevated flex items-center justify-center text-xs font-medium text-text-secondary">
            {index + 1}
          </span>

          {/* Agent name */}
          <span className="flex-1 text-sm font-medium text-text-primary truncate">
            {step.agentName}
          </span>

          {/* On-failure toggle */}
          <button
            type="button"
            onClick={() => handleToggleOnFailure(index)}
            className="flex-shrink-0"
            aria-label={`Toggle on-failure behavior for step ${index + 1}`}
          >
            <Badge variant={step.onFailure === 'stop' ? 'danger' : 'warning'}>
              on-fail: {step.onFailure}
            </Badge>
          </button>

          {/* Reorder buttons */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => handleMoveUp(index)}
              disabled={index === 0}
              className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:pointer-events-none"
              aria-label="Move step up"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => handleMoveDown(index)}
              disabled={index === steps.length - 1}
              className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:pointer-events-none"
              aria-label="Move step down"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Remove button */}
          <button
            type="button"
            onClick={() => handleRemove(index)}
            className="p-1 rounded text-text-secondary hover:text-status-danger hover:bg-bg-hover flex-shrink-0"
            aria-label={`Remove step ${index + 1}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      {/* Validation hint */}
      {steps.length > 0 && steps.length < 2 && (
        <p className="text-xs text-status-warning mt-1">
          A pipeline requires at least 2 steps.
        </p>
      )}
    </div>
  );
}
