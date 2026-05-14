/**
 * WalkthroughOverlay — 6-step guided tour overlay.
 * Highlights relevant UI area per step with step counter, description,
 * and Next/Skip buttons. Persists state in localStorage for MVP.
 */
import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

interface WalkthroughStep {
  title: string;
  description: string;
  target: string; // CSS selector or area name for highlighting
}

const STEPS: WalkthroughStep[] = [
  {
    title: 'Workspace Builder',
    description:
      'This is your workspace builder. Here you can see all your agents, skills, and pipelines organized as cards.',
    target: 'workspace-builder',
  },
  {
    title: 'Adding a Skill',
    description:
      'Skills are reusable prompt templates. Click "+ Skill" to create one from a template, paste markdown, upload a file, or start blank.',
    target: 'add-skill',
  },
  {
    title: 'Adding an Agent',
    description:
      'Agents are AI workers with assigned skills and a model. Click "+ Agent" to configure one with a name, skills, and model selection.',
    target: 'add-agent',
  },
  {
    title: 'Creating a Pipeline',
    description:
      'Pipelines chain agents into sequential workflows. Add at least 2 agent steps and configure on-failure behavior for each.',
    target: 'add-pipeline',
  },
  {
    title: 'Running an Epic',
    description:
      'Epic runs execute a pipeline against a work item. Each step requires human approval before advancing to the next agent.',
    target: 'epic-runs',
  },
  {
    title: 'Sidebar Panel',
    description:
      'The sidebar shows live counts, active run statuses, and slash commands. It updates in real-time via WebSocket.',
    target: 'sidebar',
  },
];

const STORAGE_KEY = 'aidlc-walkthrough-state';

interface WalkthroughState {
  currentStep: number;
  completed: boolean;
  dismissed: boolean;
}

function loadState(): WalkthroughState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return { currentStep: 0, completed: false, dismissed: false };
}

function saveState(state: WalkthroughState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

interface WalkthroughOverlayProps {
  /** Force show even if previously dismissed */
  forceShow?: boolean;
  onComplete?: () => void;
  onDismiss?: () => void;
}

export function WalkthroughOverlay({ forceShow, onComplete, onDismiss }: WalkthroughOverlayProps) {
  const [state, setState] = useState<WalkthroughState>(loadState);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const loaded = loadState();
    setState(loaded);
    setVisible(forceShow || (!loaded.completed && !loaded.dismissed));
  }, [forceShow]);

  const currentStep = STEPS[state.currentStep];

  const handleNext = useCallback(() => {
    setState((prev) => {
      const nextStep = prev.currentStep + 1;
      if (nextStep >= STEPS.length) {
        const newState = { currentStep: 0, completed: true, dismissed: false };
        saveState(newState);
        setVisible(false);
        onComplete?.();
        return newState;
      }
      const newState = { ...prev, currentStep: nextStep };
      saveState(newState);
      return newState;
    });
  }, [onComplete]);

  const handleSkip = useCallback(() => {
    const newState = { ...state, dismissed: true };
    saveState(newState);
    setState(newState);
    setVisible(false);
    onDismiss?.();
  }, [state, onDismiss]);

  const handleRestart = useCallback(() => {
    const newState = { currentStep: 0, completed: false, dismissed: false };
    saveState(newState);
    setState(newState);
    setVisible(true);
  }, []);

  if (!visible || !currentStep) {
    // Show resume prompt if walkthrough is incomplete
    if (!state.completed && state.dismissed) {
      return (
        <div className="fixed bottom-4 right-4 z-40">
          <button
            type="button"
            onClick={handleRestart}
            className="px-3 py-2 rounded-lg bg-accent-primary text-white text-xs font-medium shadow-lg hover:bg-accent-hover transition-colors"
          >
            Resume Walkthrough
          </button>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Semi-transparent overlay */}
      <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={handleSkip} />

      {/* Tooltip card */}
      <div
        className={cn(
          'absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-auto',
          'w-full max-w-md rounded-xl bg-[#242424] border border-border-default shadow-xl p-5',
          'animate-in fade-in-0 slide-in-from-bottom-4 duration-200',
        )}
      >
        {/* Step counter */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] text-text-secondary uppercase tracking-wide">
            Step {state.currentStep + 1} of {STEPS.length}
          </span>
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-2 h-2 rounded-full transition-colors',
                  i === state.currentStep ? 'bg-accent-primary' : 'bg-bg-elevated',
                  i < state.currentStep && 'bg-status-success',
                )}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <h3 className="text-sm font-semibold text-text-primary mb-1.5">{currentStep.title}</h3>
        <p className="text-xs text-text-secondary leading-relaxed mb-4">
          {currentStep.description}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            Skip Tour
          </Button>
          <Button size="sm" onClick={handleNext}>
            {state.currentStep === STEPS.length - 1 ? 'Finish' : 'Next'}
          </Button>
        </div>

        {/* Completion message on last step */}
        {state.currentStep === STEPS.length - 1 && (
          <div className="mt-3 pt-3 border-t border-border-subtle">
            <p className="text-xs text-text-secondary">
              You're all set! After finishing, explore the workspace builder to create your first pipeline.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
