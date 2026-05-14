/**
 * SaveTemplateDialog — Modal for saving the current workspace as a template.
 * Simple form with name and description fields.
 */
import { useState, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, TextArea } from '@/components/ui/Input';
import { templatesApi } from '../../api/workspace.service';

interface SaveTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

export function SaveTemplateDialog({ open, onClose, projectId }: SaveTemplateDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // orgId would come from context in production — using placeholder
      await templatesApi.save('default-org', {
        name: name.trim(),
        description: description.trim() || undefined,
        projectId,
      });
      setSuccess(true);
      setTimeout(() => {
        onClose();
        resetForm();
      }, 1500);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save template');
    } finally {
      setSaving(false);
    }
  }, [name, description, projectId, onClose]);

  const resetForm = useCallback(() => {
    setName('');
    setDescription('');
    setError(null);
    setSuccess(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Save as Template"
      description="Save your current workspace configuration as a reusable template."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} disabled={success}>
            {success ? '✓ Saved' : 'Save Template'}
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

        {success && (
          <div className="text-sm text-status-success bg-[rgba(34,197,94,0.1)] px-3 py-2 rounded-md">
            Template saved successfully!
          </div>
        )}

        <Input
          label="Template Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. My SDLC Setup"
        />

        <TextArea
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of what this template includes"
          rows={3}
        />
      </div>
    </Modal>
  );
}
