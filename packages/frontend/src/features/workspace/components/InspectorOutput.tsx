/**
 * InspectorOutput — Pre-formatted YAML output panel with error/warning display.
 * Shows the resolved workspace YAML with validation summary.
 */
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import type { InspectResult } from '../api/workspace.service';

export interface InspectorOutputProps {
  result: InspectResult | null;
  loading?: boolean;
  className?: string;
}

export function InspectorOutput({ result, loading, className }: InspectorOutputProps) {
  if (loading) {
    return (
      <div className={cn('rounded-xl bg-bg-surface border border-border-subtle p-6', className)}>
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Inspecting workspace...
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className={cn('rounded-xl bg-bg-surface border border-border-subtle p-6', className)}>
        <p className="text-sm text-text-secondary text-center">
          Click "Inspect" to validate and resolve your workspace configuration.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl bg-bg-surface border border-border-subtle overflow-hidden', className)}>
      {/* Validation summary header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-bg-elevated">
        <div className="flex items-center gap-2">
          <Badge variant={result.valid ? 'success' : 'danger'}>
            {result.valid ? 'Valid' : 'Invalid'}
          </Badge>
          {result.entities && (
            <span className="text-xs text-text-secondary">
              {result.entities.agents} agents · {result.entities.skills} skills · {result.entities.pipelines} pipelines · {result.entities.slashCommands} commands
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {result.errors && result.errors.length > 0 && (
            <span className="text-xs text-status-danger">
              {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}
            </span>
          )}
          {result.warnings && result.warnings.length > 0 && (
            <span className="text-xs text-status-warning">
              {result.warnings.length} warning{result.warnings.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Errors */}
      {result.errors && result.errors.length > 0 && (
        <div className="px-4 py-3 border-b border-border-subtle bg-[rgba(239,68,68,0.04)]">
          <p className="text-xs font-medium text-status-danger mb-2">Errors</p>
          <ul className="space-y-1">
            {result.errors.map((error, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <span className="flex-shrink-0 font-mono text-text-secondary">
                  line {error.line}:
                </span>
                <span className="text-status-danger">{error.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {result.warnings && result.warnings.length > 0 && (
        <div className="px-4 py-3 border-b border-border-subtle bg-[rgba(245,158,11,0.04)]">
          <p className="text-xs font-medium text-status-warning mb-2">Unresolved Variables</p>
          <ul className="space-y-1">
            {result.warnings.map((warning, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <span className="font-mono text-status-warning">${'{' + warning.variable + '}'}</span>
                <span className="text-text-secondary">{warning.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Resolved YAML output */}
      {result.resolvedYaml && (
        <div className="p-4 overflow-x-auto">
          <pre className="text-xs font-mono text-text-primary whitespace-pre leading-relaxed">
            {result.resolvedYaml}
          </pre>
        </div>
      )}
    </div>
  );
}
