import { useTranslation } from 'react-i18next';

const defaultPhases = [
  { name: 'Idea', order: 1 },
  { name: 'Ready for Dev', order: 2 },
  { name: 'In Dev', order: 3 },
  { name: 'In Review', order: 4 },
  { name: 'In Test', order: 5 },
  { name: 'Ready for Release', order: 6 },
  { name: 'In Production', order: 7 },
];

export function WorkflowPage() {
  const { t } = useTranslation();

  return (
    <div>
      <h1 className="text-lg font-semibold text-text-primary mb-6">
        {t('projects.workflow')}
      </h1>

      {/* Phase cards */}
      <div className="space-y-3">
        {defaultPhases.map((phase) => (
          <div
            key={phase.name}
            className="flex items-center gap-4 p-4 rounded-xl bg-bg-surface border border-border-subtle"
          >
            <span className="flex items-center justify-center w-8 h-8 rounded-md bg-bg-elevated text-sm font-medium text-text-secondary">
              {phase.order}
            </span>
            <span className="text-sm font-medium text-text-primary">{phase.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
