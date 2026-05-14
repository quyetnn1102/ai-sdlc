/**
 * AddSkillWizard — Modal dialog for creating a new skill.
 * Supports 4 source tabs: template, paste, upload, blank.
 */
import { useState, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { StaticTabs } from '@/components/ui/Tabs';
import { SkillEditor } from '../SkillEditor';
import { skillsApi, type SkillTemplate } from '../../api/workspace.service';
import { useQuery } from '@/lib/hooks';

interface AddSkillWizardProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onSuccess?: () => void;
}

type SourceTab = 'template' | 'paste' | 'upload' | 'blank';

const TABS: Array<{ key: SourceTab; label: string }> = [
  { key: 'template', label: 'Template' },
  { key: 'paste', label: 'Paste' },
  { key: 'upload', label: 'Upload' },
  { key: 'blank', label: 'Blank' },
];

const BLANK_CONTENT = `---
name: my-skill
description: A brief description of what this skill does
inputs:
  - name: input_name
    type: string
outputs:
  - name: output_name
    type: string
---

## Prompt Template

Your prompt here...
`;

export function AddSkillWizard({ open, onClose, projectId, onSuccess }: AddSkillWizardProps) {
  const [activeTab, setActiveTab] = useState<SourceTab>('template');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: templates } = useQuery(
    open ? () => skillsApi.templates(projectId) : null,
    [projectId, open],
  );

  const handleSelectTemplate = useCallback((template: SkillTemplate) => {
    setContent(template.content);
    setActiveTab('paste'); // Switch to paste tab to show editor
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setError('File must be under 1MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setContent(reader.result as string);
      setError(null);
    };
    reader.readAsText(file);
  }, []);

  const handleSave = useCallback(
    async (skillContent: string) => {
      setSaving(true);
      setError(null);
      try {
        // Extract name from frontmatter
        const nameMatch = skillContent.match(/^name:\s*(.+)/m);
        const name = nameMatch?.[1]?.trim() ?? 'untitled-skill';
        const descMatch = skillContent.match(/^description:\s*(.+)/m);
        const description = descMatch?.[1]?.trim();

        await skillsApi.create(projectId, { name, description, content: skillContent });
        onSuccess?.();
        onClose();
        setContent('');
      } catch (err: any) {
        setError(err?.message ?? 'Failed to create skill');
      } finally {
        setSaving(false);
      }
    },
    [projectId, onSuccess, onClose],
  );

  const handleClose = useCallback(() => {
    setContent('');
    setError(null);
    setActiveTab('template');
    onClose();
  }, [onClose]);

  return (
    <Modal open={open} onClose={handleClose} title="Add Skill" size="lg">
      <div className="space-y-4">
        <StaticTabs
          tabs={TABS}
          active={activeTab}
          onChange={(key) => setActiveTab(key as SourceTab)}
        />

        {error && (
          <div className="text-sm text-status-danger bg-[rgba(239,68,68,0.1)] px-3 py-2 rounded-md">
            {error}
          </div>
        )}

        {activeTab === 'template' && (
          <div className="space-y-2">
            {!templates || templates.length === 0 ? (
              <p className="text-sm text-text-secondary py-4 text-center">
                No templates available.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                {templates.map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => handleSelectTemplate(t)}
                    className="text-left p-3 rounded-lg bg-bg-elevated border border-border-subtle hover:border-border-default transition-colors"
                  >
                    <p className="text-sm font-medium text-text-primary">{t.name}</p>
                    <p className="text-xs text-text-secondary mt-0.5">{t.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'paste' && (
          <SkillEditor
            initialContent={content}
            onSave={handleSave}
            onCancel={handleClose}
            saving={saving}
          />
        )}

        {activeTab === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border-subtle rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".md,.markdown"
                onChange={handleFileUpload}
                className="block mx-auto text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-accent-primary file:text-white hover:file:bg-accent-hover"
              />
              <p className="text-xs text-text-disabled mt-2">
                Upload a .md file (max 1MB)
              </p>
            </div>
            {content && (
              <SkillEditor
                initialContent={content}
                onSave={handleSave}
                onCancel={() => setContent('')}
                saving={saving}
              />
            )}
          </div>
        )}

        {activeTab === 'blank' && (
          <SkillEditor
            initialContent={BLANK_CONTENT}
            onSave={handleSave}
            onCancel={handleClose}
            saving={saving}
          />
        )}
      </div>
    </Modal>
  );
}
