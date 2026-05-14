/**
 * SkillEditor — Textarea-based markdown editor with basic YAML frontmatter
 * validation display. Shows validation errors inline.
 */
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

export interface SkillEditorProps {
  /** Initial markdown content */
  initialContent?: string;
  /** Called when the user saves valid content */
  onSave?: (content: string) => void;
  /** Called when the user cancels editing */
  onCancel?: () => void;
  /** External validation errors (e.g., from server) */
  validationErrors?: Array<{ field: string; message: string }>;
  /** Whether save is in progress */
  saving?: boolean;
  className?: string;
}

interface LocalValidation {
  valid: boolean;
  errors: string[];
}

function validateSkillMarkdown(content: string): LocalValidation {
  const errors: string[] = [];

  if (!content.trim()) {
    return { valid: false, errors: ['Content cannot be empty'] };
  }

  // Check for YAML frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    errors.push('Missing YAML frontmatter (must start with --- and end with ---)');
    return { valid: false, errors };
  }

  const frontmatter = frontmatterMatch[1];

  // Check required fields
  if (!/^name:\s*.+/m.test(frontmatter)) {
    errors.push('Missing required field: name');
  }
  if (!/^description:\s*.+/m.test(frontmatter)) {
    errors.push('Missing required field: description');
  }

  // Check for prompt template in body
  const body = content.slice(frontmatterMatch[0].length).trim();
  if (!body) {
    errors.push('Missing prompt template (body content after frontmatter)');
  }

  return { valid: errors.length === 0, errors };
}

export function SkillEditor({
  initialContent = '',
  onSave,
  onCancel,
  validationErrors,
  saving = false,
  className,
}: SkillEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [localValidation, setLocalValidation] = useState<LocalValidation | null>(null);

  const handleSave = useCallback(() => {
    const result = validateSkillMarkdown(content);
    setLocalValidation(result);
    if (result.valid) {
      onSave?.(content);
    }
  }, [content, onSave]);

  const allErrors = [
    ...(localValidation?.errors ?? []),
    ...(validationErrors?.map((e) => `${e.field}: ${e.message}`) ?? []),
  ];

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="relative">
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            // Clear local validation on edit
            if (localValidation) setLocalValidation(null);
          }}
          placeholder={`---\nname: my-skill\ndescription: A brief description\ninputs:\n  - name: input_name\n    type: string\noutputs:\n  - name: output_name\n    type: string\n---\n\n## Prompt Template\n\nYour prompt here...`}
          className={cn(
            'w-full min-h-[300px] p-4 rounded-lg font-mono text-sm',
            'bg-bg-elevated border border-border-subtle text-text-primary',
            'placeholder:text-text-secondary/50',
            'focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-accent-primary',
            'resize-y',
            allErrors.length > 0 && 'border-status-danger focus:ring-status-danger',
          )}
          aria-label="Skill markdown editor"
          aria-invalid={allErrors.length > 0}
        />
        <div className="absolute top-2 right-2 text-[10px] text-text-secondary bg-bg-surface px-1.5 py-0.5 rounded">
          Markdown
        </div>
      </div>

      {/* Validation errors */}
      {allErrors.length > 0 && (
        <div className="rounded-lg bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] p-3">
          <p className="text-xs font-medium text-status-danger mb-1">Validation errors:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {allErrors.map((error, i) => (
              <li key={i} className="text-xs text-status-danger">{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button size="sm" onClick={handleSave} loading={saving}>
          Save Skill
        </Button>
      </div>
    </div>
  );
}
