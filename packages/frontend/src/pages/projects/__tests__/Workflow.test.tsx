/**
 * Unit tests for WorkflowPage — Phase-Agent Mapping UI section
 *
 * Feature: agent-workflow-automation
 * Requirements: 2.1, 2.2, 2.3
 *
 * Note: Run with `npm test` after installing vitest and @testing-library/react.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { WorkflowPage } from '../Workflow';

// ── Module mocks ──────────────────────────────────────────────────────────

vi.mock('@/services/workflow.service', () => ({
  workflowService: {
    listPhases:    vi.fn(),
    createPhase:   vi.fn(),
    addMapping:    vi.fn(),
    removeMapping: vi.fn(),
  },
}));

vi.mock('@/services/agents.service', () => ({
  agentsService: {
    listProfiles:     vi.fn(),
    listMappings:     vi.fn(),
    createMapping:    vi.fn(),
    deleteMapping:    vi.fn(),
    validateMappings: vi.fn(),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────

function makePhase(overrides = {}) {
  return { id: 'phase-1', name: 'In Dev', order: 1, color: '#3B82F6', statusMappings: [], ...overrides };
}

function makeProfile(overrides = {}) {
  return {
    id: 'profile-1', name: 'Dev Agent', role: 'DEV_AGENT',
    description: 'A dev agent', skillSet: ['typescript'],
    supportedPhases: ['In Dev'], isDefault: false,
    createdAt: '2026-01-01T00:00:00Z', _count: { phaseMappings: 0 },
    ...overrides,
  };
}

function makeMapping(overrides = {}) {
  return {
    id: 'mapping-1', projectId: 'project-1', phaseId: 'phase-1',
    agentProfileId: 'profile-1', priority: 0,
    agentProfile: { id: 'profile-1', name: 'Dev Agent', role: 'DEV_AGENT', skillSet: ['typescript'] },
    ...overrides,
  };
}

function renderWorkflowPage() {
  return render(
    <MemoryRouter initialEntries={['/projects/project-1/workflow']}>
      <Routes>
        <Route path="/projects/:id/workflow" element={<WorkflowPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('WorkflowPage — Phase-Agent Mapping UI', () => {
  let workflowService: any;
  let agentsService: any;

  beforeEach(async () => {
    const workflowMod = await import('@/services/workflow.service');
    const agentsMod   = await import('@/services/agents.service');
    workflowService = workflowMod.workflowService;
    agentsService   = agentsMod.agentsService;

    workflowService.listPhases.mockResolvedValue([]);
    agentsService.listProfiles.mockResolvedValue([]);
    agentsService.listMappings.mockResolvedValue([]);
    agentsService.validateMappings.mockResolvedValue({ valid: true, issues: [] });
  });

  describe('Agent assignment per phase (Req 2.1)', () => {
    it('shows "No agents assigned" when phase has no mappings', async () => {
      workflowService.listPhases.mockResolvedValue([makePhase()]);
      agentsService.listMappings.mockResolvedValue([]);
      renderWorkflowPage();
      await waitFor(() => {
        expect(screen.getByText('In Dev')).toBeInTheDocument();
        expect(screen.getByText(/No agents assigned/i)).toBeInTheDocument();
      });
    });

    it('shows assigned agent chip when mapping exists', async () => {
      workflowService.listPhases.mockResolvedValue([makePhase()]);
      agentsService.listMappings.mockResolvedValue([makeMapping()]);
      renderWorkflowPage();
      await waitFor(() => {
        expect(screen.getByText('Dev Agent')).toBeInTheDocument();
      });
    });

    it('shows "Assign agent" button for each phase', async () => {
      workflowService.listPhases.mockResolvedValue([makePhase()]);
      renderWorkflowPage();
      await waitFor(() => {
        expect(screen.getByText('+ Assign agent')).toBeInTheDocument();
      });
    });
  });

  describe('Agent dropdown filters by supported phases (Req 2.2)', () => {
    it('shows "No compatible agents" when no agents support the phase', async () => {
      const phase = makePhase({ name: 'In Dev' });
      const incompatibleProfile = makeProfile({ supportedPhases: ['In Test'] });
      workflowService.listPhases.mockResolvedValue([phase]);
      agentsService.listProfiles.mockResolvedValue([incompatibleProfile]);
      agentsService.listMappings.mockResolvedValue([]);
      renderWorkflowPage();
      await waitFor(() => screen.getByText('+ Assign agent'));
      fireEvent.click(screen.getByText('+ Assign agent'));
      await waitFor(() => {
        expect(screen.getByText(/No compatible agents/i)).toBeInTheDocument();
      });
    });

    it('opens assign modal when "Assign agent" is clicked', async () => {
      workflowService.listPhases.mockResolvedValue([makePhase()]);
      agentsService.listProfiles.mockResolvedValue([makeProfile()]);
      renderWorkflowPage();
      await waitFor(() => screen.getByText('+ Assign agent'));
      fireEvent.click(screen.getByText('+ Assign agent'));
      await waitFor(() => {
        expect(screen.getByText(/Assign agent to/i)).toBeInTheDocument();
      });
    });
  });

  describe('Validation results display (Req 2.3)', () => {
    it('shows success message when all mappings are valid', async () => {
      workflowService.listPhases.mockResolvedValue([makePhase()]);
      agentsService.validateMappings.mockResolvedValue({ valid: true, issues: [] });
      renderWorkflowPage();
      await waitFor(() => screen.getByText('Validate agent mappings'));
      fireEvent.click(screen.getByText('Validate agent mappings'));
      await waitFor(() => {
        expect(screen.getByText(/All phases have valid agent mappings/i)).toBeInTheDocument();
      });
    });

    it('shows warning with issues when mappings are invalid', async () => {
      workflowService.listPhases.mockResolvedValue([makePhase()]);
      agentsService.validateMappings.mockResolvedValue({
        valid: false,
        issues: [{ phaseId: 'p1', phaseName: 'In Test', issue: 'no_mapping', message: 'Phase "In Test" has no agent mapping configured' }],
      });
      renderWorkflowPage();
      await waitFor(() => screen.getByText('Validate agent mappings'));
      fireEvent.click(screen.getByText('Validate agent mappings'));
      await waitFor(() => {
        expect(screen.getByText(/1 mapping issue/i)).toBeInTheDocument();
      });
    });
  });

  describe('Remove agent mapping', () => {
    it('calls deleteMapping when X button is clicked on agent chip', async () => {
      workflowService.listPhases.mockResolvedValue([makePhase()]);
      agentsService.listMappings.mockResolvedValue([makeMapping()]);
      agentsService.deleteMapping.mockResolvedValue(undefined);
      renderWorkflowPage();
      await waitFor(() => {
        expect(screen.getByText('Dev Agent')).toBeInTheDocument();
      });
      const removeButtons = screen.getAllByText('✕');
      fireEvent.click(removeButtons[0]);
      await waitFor(() => {
        expect(agentsService.deleteMapping).toHaveBeenCalledWith('project-1', 'mapping-1');
      });
    });
  });
});
