/**
 * Unit tests for ExecutionsPage (Workflow Execution Dashboard)
 *
 * Feature: agent-workflow-automation
 * Requirements: 8.1, 8.2, 9.2, 9.3, 9.4
 *
 * Note: Run with `npm test` after installing vitest and @testing-library/react.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ExecutionsPage } from '../Executions';

// ── Module mocks ──────────────────────────────────────────────────────────

vi.mock('@/services/executions.service', () => ({
  executionsService: {
    list:         vi.fn(),
    get:          vi.fn(),
    start:        vi.fn(),
    pause:        vi.fn(),
    resume:       vi.fn(),
    cancel:       vi.fn(),
    getDag:       vi.fn(),
    getArtifacts: vi.fn(),
  },
}));

vi.mock('@/components/dag/DagVisualization', () => ({
  DagVisualization: ({ data }: any) => (
    <div data-testid="dag-visualization">
      {data?.tasks?.map((t: any) => (
        <div key={t.id} data-testid={`dag-node-${t.id}`} data-status={t.status}>
          {t.phaseName}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/dag/TaskDetailPanel', () => ({
  TaskDetailPanel: ({ task, onClose }: any) => (
    <div data-testid="task-detail-panel">
      <span>{task.phaseName}</span>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// ── Helpers ───────────────────────────────────────────────────────────────

function makeSummary(overrides: Partial<{
  id: string; status: string; createdAt: string; startedAt: string | null;
  completedAt: string | null; _count: { tasks: number };
}> = {}) {
  return {
    id: 'exec-1',
    status: 'RUNNING',
    createdAt: '2026-01-01T10:00:00Z',
    startedAt: '2026-01-01T10:00:00Z',
    completedAt: null,
    _count: { tasks: 3 },
    ...overrides,
  };
}

function makeExecution(overrides: Partial<{
  id: string; status: string; startedAt: string | null; completedAt: string | null;
  tasks: unknown[]; progress: { completed: number; total: number; percentage: number };
}> = {}) {
  return {
    id: 'exec-1',
    status: 'RUNNING',
    startedAt: '2026-01-01T10:00:00Z',
    completedAt: null,
    tasks: [],
    progress: { completed: 0, total: 3, percentage: 0 },
    ...overrides,
  };
}

function makeDag(overrides: Partial<{
  tasks: unknown[]; edges: unknown[]; criticalPath: string[];
  progress: { completed: number; total: number; percentage: number };
}> = {}) {
  return {
    tasks: [],
    edges: [],
    criticalPath: [],
    progress: { completed: 0, total: 0, percentage: 0 },
    ...overrides,
  };
}

function renderExecutionsPage() {
  return render(
    <MemoryRouter initialEntries={['/projects/project-1/workflow-executions']}>
      <Routes>
        <Route path="/projects/:id/workflow-executions" element={<ExecutionsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('ExecutionsPage', () => {
  let executionsService: any;

  beforeEach(async () => {
    const mod = await import('@/services/executions.service');
    executionsService = mod.executionsService;

    executionsService.list.mockResolvedValue([]);
    executionsService.get.mockResolvedValue(makeExecution());
    executionsService.getDag.mockResolvedValue(makeDag());
    executionsService.getArtifacts.mockResolvedValue({ executionId: 'exec-1', totalArtifacts: 0, byPhase: [] });
  });

  // ── Status badge rendering (Req 8.1) ──────────────────────────────────

  describe('Status badge rendering (Req 8.1)', () => {
    it('renders RUNNING badge for running execution', async () => {
      executionsService.list.mockResolvedValue([makeSummary({ status: 'RUNNING' })]);
      renderExecutionsPage();
      await waitFor(() => {
        expect(screen.getByText('RUNNING')).toBeInTheDocument();
      });
    });

    it('renders COMPLETED badge for completed execution', async () => {
      executionsService.list.mockResolvedValue([
        makeSummary({ status: 'COMPLETED', completedAt: '2026-01-01T11:00:00Z' }),
      ]);
      renderExecutionsPage();
      await waitFor(() => {
        expect(screen.getByText('COMPLETED')).toBeInTheDocument();
      });
    });

    it('renders FAILED badge for failed execution', async () => {
      executionsService.list.mockResolvedValue([makeSummary({ status: 'FAILED' })]);
      renderExecutionsPage();
      await waitFor(() => {
        expect(screen.getByText('FAILED')).toBeInTheDocument();
      });
    });

    it('renders PAUSED badge for paused execution', async () => {
      executionsService.list.mockResolvedValue([makeSummary({ status: 'PAUSED' })]);
      renderExecutionsPage();
      await waitFor(() => {
        expect(screen.getByText('PAUSED')).toBeInTheDocument();
      });
    });

    it('renders CANCELLED badge for cancelled execution', async () => {
      executionsService.list.mockResolvedValue([makeSummary({ status: 'CANCELLED' })]);
      renderExecutionsPage();
      await waitFor(() => {
        expect(screen.getByText('CANCELLED')).toBeInTheDocument();
      });
    });

    it('renders BLOCKED badge for blocked execution', async () => {
      executionsService.list.mockResolvedValue([makeSummary({ status: 'BLOCKED' })]);
      renderExecutionsPage();
      await waitFor(() => {
        expect(screen.getByText('BLOCKED')).toBeInTheDocument();
      });
    });
  });

  // ── Pause/Resume/Cancel button visibility (Req 9.2, 9.3, 9.4) ────────

  describe('Pause/Resume/Cancel button visibility', () => {
    it('shows Pause and Cancel buttons for RUNNING execution', async () => {
      executionsService.list.mockResolvedValue([makeSummary({ status: 'RUNNING' })]);
      executionsService.get.mockResolvedValue(makeExecution({ status: 'RUNNING' }));
      executionsService.getDag.mockResolvedValue(makeDag());

      renderExecutionsPage();

      // Click on the execution to open detail view
      await waitFor(() => screen.getByText('RUNNING'));
      fireEvent.click(screen.getByText('RUNNING'));

      await waitFor(() => {
        expect(screen.getByText(/Pause/i)).toBeInTheDocument();
        expect(screen.getByText(/Cancel/i)).toBeInTheDocument();
        expect(screen.queryByText(/Resume/i)).not.toBeInTheDocument();
      });
    });

    it('shows Resume and Cancel buttons for PAUSED execution (Req 9.3)', async () => {
      executionsService.list.mockResolvedValue([makeSummary({ status: 'PAUSED' })]);
      executionsService.get.mockResolvedValue(makeExecution({ status: 'PAUSED' }));
      executionsService.getDag.mockResolvedValue(makeDag());

      renderExecutionsPage();

      await waitFor(() => screen.getByText('PAUSED'));
      fireEvent.click(screen.getByText('PAUSED'));

      await waitFor(() => {
        expect(screen.getByText(/Resume/i)).toBeInTheDocument();
        expect(screen.getByText(/Cancel/i)).toBeInTheDocument();
        expect(screen.queryByText(/Pause/i)).not.toBeInTheDocument();
      });
    });

    it('shows no control buttons for COMPLETED execution', async () => {
      executionsService.list.mockResolvedValue([makeSummary({ status: 'COMPLETED' })]);
      executionsService.get.mockResolvedValue(makeExecution({ status: 'COMPLETED' }));
      executionsService.getDag.mockResolvedValue(makeDag());

      renderExecutionsPage();

      await waitFor(() => screen.getByText('COMPLETED'));
      fireEvent.click(screen.getByText('COMPLETED'));

      await waitFor(() => {
        expect(screen.queryByText(/Pause/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Resume/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Cancel/i)).not.toBeInTheDocument();
      });
    });
  });

  // ── DAG node coloring by status (Req 8.2) ────────────────────────────

  describe('DAG node coloring by status (Req 8.2)', () => {
    it('renders DAG visualization with task nodes', async () => {
      const tasks = [
        { id: 't1', phaseName: 'Requirements', status: 'DONE',    agentName: 'BA Agent',  isCriticalPath: true  },
        { id: 't2', phaseName: 'In Dev',        status: 'RUNNING', agentName: 'Dev Agent', isCriticalPath: true  },
        { id: 't3', phaseName: 'In Test',       status: 'PENDING', agentName: 'QA Agent',  isCriticalPath: false },
      ];
      executionsService.list.mockResolvedValue([makeSummary({ status: 'RUNNING' })]);
      executionsService.get.mockResolvedValue(makeExecution({ status: 'RUNNING' }));
      executionsService.getDag.mockResolvedValue(makeDag({ tasks, criticalPath: ['t1', 't2'] }));

      renderExecutionsPage();

      await waitFor(() => screen.getByText('RUNNING'));
      fireEvent.click(screen.getByText('RUNNING'));

      await waitFor(() => {
        expect(screen.getByTestId('dag-visualization')).toBeInTheDocument();
        expect(screen.getByTestId('dag-node-t1')).toBeInTheDocument();
        expect(screen.getByTestId('dag-node-t2')).toBeInTheDocument();
        expect(screen.getByTestId('dag-node-t3')).toBeInTheDocument();
      });

      // Verify status data attributes
      expect(screen.getByTestId('dag-node-t1')).toHaveAttribute('data-status', 'DONE');
      expect(screen.getByTestId('dag-node-t2')).toHaveAttribute('data-status', 'RUNNING');
      expect(screen.getByTestId('dag-node-t3')).toHaveAttribute('data-status', 'PENDING');
    });
  });

  // ── Polling starts/stops based on execution status ────────────────────

  describe('Polling behavior', () => {
    it('shows empty state when no executions exist', async () => {
      executionsService.list.mockResolvedValue([]);
      renderExecutionsPage();
      await waitFor(() => {
        expect(screen.getByText(/No executions yet/i)).toBeInTheDocument();
      });
    });

    it('shows "Start Workflow" button', async () => {
      renderExecutionsPage();
      await waitFor(() => {
        expect(screen.getByText('▶ Start Workflow')).toBeInTheDocument();
      });
    });
  });

  // ── Start workflow dialog ─────────────────────────────────────────────

  describe('Start workflow dialog (Req 9.1)', () => {
    it('opens start dialog when "Start Workflow" is clicked', async () => {
      renderExecutionsPage();
      await waitFor(() => screen.getByText('▶ Start Workflow'));
      fireEvent.click(screen.getByText('▶ Start Workflow'));
      await waitFor(() => {
        expect(screen.getByText('Start Workflow Execution')).toBeInTheDocument();
      });
    });

    it('calls executionsService.start with config on submit', async () => {
      const newExecution = makeExecution({ id: 'exec-new', status: 'RUNNING' });
      executionsService.start.mockResolvedValue(newExecution);
      executionsService.get.mockResolvedValue(newExecution);
      executionsService.getDag.mockResolvedValue(makeDag());

      renderExecutionsPage();
      await waitFor(() => screen.getByText('▶ Start Workflow'));
      fireEvent.click(screen.getByText('▶ Start Workflow'));

      await waitFor(() => screen.getByText('▶ Start Workflow', { selector: 'button[type="submit"]' }));
      fireEvent.click(screen.getByText('▶ Start Workflow', { selector: 'button[type="submit"]' }));

      await waitFor(() => {
        expect(executionsService.start).toHaveBeenCalledWith(
          'project-1',
          expect.objectContaining({ maxConcurrency: 5 }),
        );
      });
    });
  });

  // ── Pause action ──────────────────────────────────────────────────────

  describe('Pause action (Req 9.2)', () => {
    it('calls executionsService.pause when Pause button is clicked', async () => {
      executionsService.list.mockResolvedValue([makeSummary({ status: 'RUNNING' })]);
      executionsService.get.mockResolvedValue(makeExecution({ status: 'RUNNING' }));
      executionsService.getDag.mockResolvedValue(makeDag());
      executionsService.pause.mockResolvedValue(makeExecution({ status: 'PAUSED' }));

      renderExecutionsPage();

      await waitFor(() => screen.getByText('RUNNING'));
      fireEvent.click(screen.getByText('RUNNING'));

      await waitFor(() => screen.getByText(/Pause/i));
      fireEvent.click(screen.getByText(/Pause/i));

      await waitFor(() => {
        expect(executionsService.pause).toHaveBeenCalledWith('project-1', 'exec-1');
      });
    });
  });

  // ── Cancel action ─────────────────────────────────────────────────────

  describe('Cancel action (Req 9.4)', () => {
    it('calls executionsService.cancel when Cancel button is clicked', async () => {
      executionsService.list.mockResolvedValue([makeSummary({ status: 'RUNNING' })]);
      executionsService.get.mockResolvedValue(makeExecution({ status: 'RUNNING' }));
      executionsService.getDag.mockResolvedValue(makeDag());
      executionsService.cancel.mockResolvedValue(makeExecution({ status: 'CANCELLED' }));

      renderExecutionsPage();

      await waitFor(() => screen.getByText('RUNNING'));
      fireEvent.click(screen.getByText('RUNNING'));

      await waitFor(() => screen.getByText(/Cancel/i));
      fireEvent.click(screen.getByText(/Cancel/i));

      await waitFor(() => {
        expect(executionsService.cancel).toHaveBeenCalledWith('project-1', 'exec-1');
      });
    });
  });
});
