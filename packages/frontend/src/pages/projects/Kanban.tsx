import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@/lib/hooks';
import { workItemsService, type WorkItem } from '@/services/workitems.service';
import { workflowService } from '@/services/workflow.service';
import { PageHeader } from '@/components/ui/PageHeader';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge, statusToVariant } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';

function KanbanCard({ item }: { item: WorkItem }) {
  return (
    <div className="p-3 rounded-md bg-bg-elevated border border-border-subtle hover:border-border-default transition-colors">
      <p className="text-sm text-text-primary leading-snug">{item.title}</p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[11px] text-text-secondary font-mono">{item.externalId}</span>
        <div className="flex items-center gap-1.5">
          {item.priority && (
            <span className="text-[10px] text-text-disabled">{item.priority}</span>
          )}
          <Badge variant={statusToVariant(item.status)} className="text-[10px]">
            {item.type}
          </Badge>
        </div>
      </div>
      {item.assignee && (
        <p className="text-[11px] text-text-disabled mt-1">↳ {item.assignee}</p>
      )}
    </div>
  );
}

export function KanbanPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { t } = useTranslation();

  const [assignee, setAssignee] = useState('');
  const [type, setType] = useState('');

  const { data: phases, loading: phasesLoading } = useQuery(
    () => workflowService.listPhases(projectId!), [projectId],
  );

  const { data: items, loading: itemsLoading } = useQuery(
    () => workItemsService.list({ projectId: projectId!, assignee: assignee || undefined, type: type || undefined }),
    [projectId, assignee, type],
  );

  const loading = phasesLoading || itemsLoading;

  // Group items by phase
  const byPhase = (phases ?? []).reduce<Record<string, WorkItem[]>>((acc, p) => {
    acc[p.name] = (items ?? []).filter((item) => item.phase === p.name);
    return acc;
  }, {});

  // Unassigned items (no phase match)
  const assigned = new Set((items ?? []).filter((i) => i.phase).map((i) => i.id));
  const unassigned = (items ?? []).filter((i) => !assigned.has(i.id));

  return (
    <div>
      <PageHeader title={t('projects.kanban')}>
      </PageHeader>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <Input
          placeholder="Filter by assignee…"
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          className="w-48"
        />
        <Select
          value={type}
          onChange={(e) => setType(e.target.value)}
          placeholder="All types"
          options={[
            { value: '', label: 'All types' },
            { value: 'EPIC', label: 'Epic' },
            { value: 'STORY', label: 'Story' },
            { value: 'TASK', label: 'Task' },
            { value: 'BUG', label: 'Bug' },
          ]}
          className="w-36"
        />
        {loading && <Spinner size="sm" />}
      </div>

      {/* Board */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {(phases ?? []).map((phase) => (
          <div key={phase.id} className="flex-shrink-0 w-[280px] rounded-xl bg-bg-surface border border-border-subtle flex flex-col">
            {/* Column header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: phase.color }} />
                <span className="text-sm font-medium text-text-primary">{phase.name}</span>
              </div>
              <span className="text-xs text-text-secondary bg-bg-elevated px-1.5 py-0.5 rounded">
                {byPhase[phase.name]?.length ?? 0}
              </span>
            </div>
            {/* Cards */}
            <div className="p-2 space-y-2 flex-1 min-h-[180px]">
              {(byPhase[phase.name] ?? []).map((item) => (
                <KanbanCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        ))}

        {/* Unassigned column */}
        {unassigned.length > 0 && (
          <div className="flex-shrink-0 w-[280px] rounded-xl bg-bg-surface border border-border-default flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
              <span className="text-sm font-medium text-text-secondary">Unassigned</span>
              <span className="text-xs text-text-secondary bg-bg-elevated px-1.5 py-0.5 rounded">
                {unassigned.length}
              </span>
            </div>
            <div className="p-2 space-y-2 flex-1">
              {unassigned.map((item) => <KanbanCard key={item.id} item={item} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
