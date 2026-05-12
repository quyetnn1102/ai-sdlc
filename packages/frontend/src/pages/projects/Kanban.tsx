import { useTranslation } from 'react-i18next';

const phases = [
  { name: 'Idea', color: '#6B7280', count: 3 },
  { name: 'Ready for Dev', color: '#3B82F6', count: 5 },
  { name: 'In Dev', color: '#4F6EF7', count: 4 },
  { name: 'In Review', color: '#F59E0B', count: 2 },
  { name: 'In Test', color: '#8B5CF6', count: 1 },
  { name: 'Released', color: '#22C55E', count: 7 },
];

export function KanbanPage() {
  const { t } = useTranslation();

  return (
    <div>
      <h1 className="text-lg font-semibold text-text-primary mb-6">
        {t('projects.kanban')}
      </h1>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {phases.map((phase) => (
          <div
            key={phase.name}
            className="flex-shrink-0 w-[280px] rounded-xl bg-bg-surface border border-border-subtle"
          >
            {/* Column header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: phase.color }}
                />
                <span className="text-sm font-medium text-text-primary">
                  {phase.name}
                </span>
              </div>
              <span className="text-xs text-text-secondary bg-bg-elevated px-1.5 py-0.5 rounded">
                {phase.count}
              </span>
            </div>

            {/* Cards placeholder */}
            <div className="p-2 space-y-2 min-h-[200px]">
              <div className="p-3 rounded-md bg-bg-elevated border border-border-subtle">
                <p className="text-sm text-text-primary">Sample item</p>
                <p className="text-xs text-text-secondary mt-1">PROJ-001</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
