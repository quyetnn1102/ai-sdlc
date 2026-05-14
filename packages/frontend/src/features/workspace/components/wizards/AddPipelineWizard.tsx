/**
 * AddPipelineWizard — Modal dialog for creating a new pipeline.
 * Name input + PipelineStepBuilder + agent selector.
 */
import { useState, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PipelineStepBuilder, type PipelineStepItem } from '../PipelineStepBuilder';
import { pipelinesApi } from '../../api/workspace.service';

interface AddPipelineWizardProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onSuccess?: () => void;
}

// Placeholder agents for the selector — in production these come from the agents API
const PLACEHOLDER_AGENTS = [
  { value: 'ba-agent', label: 'BA Agent' },
  { value: 'dev-agent', label: 'Dev Agent' },
  { value: 'qa-agent', label: 'QA Agent' },
  { value: 'devops-agent', label: 'DevOps Agent' },
];

export function AddPipelineWizard({ open, onClose, projectId, onSuccess }: AddPipelineWizardProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<PipelineStepItem[]>([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddStep = useCallback(() => {
    if (!selectedAgent) return;
    const agentLabel = PLACEHOLDER_AGENTS.find((a) => a.value === selectedAgent)?.label ?? selectedAgent;
    const newStep: PipelineStepItem = {
      id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      agentName: agentLabel,
      agentProfileId: selectedAgent,
      onFailure: 'stop',
    };
    setSteps((prev) => [...prev, newStep]);
    setSelectedAgent('');
  }, [selectedAgent]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setError('Pipeline name is required');
      return;
    }
    if (steps.length < 2) {
      setError('A pipeline requires at least 2 steps');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await pipelinesApi.create(projectId, {
        name: name.trim(),
        description: description.trim() || undefined,
        steps: steps.map((s) => ({
          agentProfileId: s.agentProfileId,
          onFailure: s.onFailure,
        })),
      });
      onSuccess?.();
      onClose();
      resetForm();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create pipeline');
    } finally {
      setSaving(false);
    }
  }, [name, description, steps, projectId, onSuccess, onClose]);

  const resetForm = useCallback(() => {
    setName('');
    setDescription('');
    setSteps([]);
    setSelectedAgent('');
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add Pipeline"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Create Pipeline</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="text-sm text-status-danger bg-[rgba(239,68,68,0.1)] px-3 py-2 rounded-md">
            {error}
          </div>
        )}

        <Input
          label="Pipeline Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. SDLC Pipeline"
        />

        <Input
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of this pipeline"
        />

        {/* Agent selector + add button */}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Select
              label="Add Agent Step"
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              options={PLACEHOLDER_AGENTS}
              placeholder="Select an agent..."
            />
          </div>
          <Button
            size="sm"
            onClick={handleAddStep}
            disabled={!selectedAgent}
          >
            + Add
          </Button>
        </div>

        {/* Step builder */}
        <PipelineStepBuilder steps={steps} onStepsChange={setSteps} />
      </div>
    </Modal>
  );
}
