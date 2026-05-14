/**
 * WorkspaceCard — Draggable card displaying a workspace entity
 * (agent, skill, or pipeline) with name, type badge, and config summary.
 */
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

export type CardType = 'agent' | 'skill' | 'pipeline';

export interface WorkspaceCardProps {
  id: string;
  name: string;
  type: CardType;
  summary: string;
  draggable?: boolean;
  selected?: boolean;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  className?: string;
}

const typeBadgeVariant: Record<CardType, 'info' | 'success' | 'warning'> = {
  agent: 'info',
  skill: 'success',
  pipeline: 'warning',
};

export function WorkspaceCard({
  id,
  name,
  type,
  summary,
  draggable = true,
  selected = false,
  onClick,
  onEdit,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  className,
}: WorkspaceCardProps) {
  return (
    <div
      data-card-id={id}
      draggable={draggable}
      onClick={onClick}
      onDragStart={onDragStart}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver?.(e);
      }}
      onDrop={onDrop}
      className={cn(
        'group relative rounded-xl bg-bg-surface border border-border-subtle p-4',
        'transition-all duration-150 cursor-grab active:cursor-grabbing',
        'hover:border-border-default hover:shadow-sm',
        selected && 'ring-2 ring-accent-primary border-accent-primary',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-medium text-text-primary truncate">{name}</h3>
            <Badge variant={typeBadgeVariant[type]}>{type}</Badge>
          </div>
          <p className="text-xs text-text-secondary line-clamp-2">{summary}</p>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover"
              aria-label={`Edit ${name}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-1 rounded text-text-secondary hover:text-status-danger hover:bg-bg-hover"
              aria-label={`Delete ${name}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Drag handle indicator */}
      {draggable && (
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50 transition-opacity">
          <svg className="w-3 h-3 text-text-secondary" viewBox="0 0 6 10" fill="currentColor">
            <circle cx="1.5" cy="1.5" r="1" />
            <circle cx="4.5" cy="1.5" r="1" />
            <circle cx="1.5" cy="5" r="1" />
            <circle cx="4.5" cy="5" r="1" />
            <circle cx="1.5" cy="8.5" r="1" />
            <circle cx="4.5" cy="8.5" r="1" />
          </svg>
        </div>
      )}
    </div>
  );
}
