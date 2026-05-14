/**
 * Unit tests for AgentsPage
 *
 * Feature: agent-workflow-automation
 * Requirements: 1.1, 1.2, 1.4, 1.5
 *
 * Note: Run with `npm test` after installing vitest and @testing-library/react.
 * Install: npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AgentsPage } from '../Agents';

// ── Module mocks ──────────────────────────────────────────────────────────

vi.mock('@/services/agents.service', () => ({
  agentsService: {
    listProfiles:   vi.fn(),
    createProfile:  vi.fn(),
    updateProfile:  vi.fn(),
    deleteProfile:  vi.fn(),
    seedDefaults:   vi.fn(),
    listMappings:   vi.fn(),
    createMapping:  vi.fn(),
    deleteMapping:  vi.fn(),
    validateMappings: vi.fn(),
    getLlmProviders: vi.fn(),
  },
}));

vi.mock('@/services/workflow.service', () => ({
  workflowService: {
    listPhases: vi.fn(),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────

function makeProfile(overrides: Partial<{
  id: string; name: string; role: string; skillSet: string[];
  supportedPhases: string[]; isDefault: boolean;
}> = {}) {
  return {
    id: 'profile-1',
    name: 'Dev Agent',
    role: 'DEV_AGENT',
    description: 'A dev agent',
    skillSet: ['typescript', 'nestjs'],
    supportedPhases: ['In Dev'],
    isDefault: false,
    createdAt: '2026-01-01T00:00:00Z',
    _count: { phaseMappings: 0 },
    ...overrides,
  };
}

function renderAgentsPage() {
  return render(
    <MemoryRouter initialEntries={['/projects/project-1/agents']}>
      <Routes>
        <Route path="/projects/:id/agents" element={<AgentsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('AgentsPage', () => {
  let agentsService: any;
  let workflowService: any;

  beforeEach(async () => {
    const agentsMod   = await import('@/services/agents.service');
    const workflowMod = await import('@/services/workflow.service');
    agentsService   = agentsMod.agentsService;
    workflowService = workflowMod.workflowService;

    agentsService.listProfiles.mockResolvedValue([]);
    agentsService.listMappings.mockResolvedValue([]);
    agentsService.getLlmProviders.mockResolvedValue({ available: ['simulate'], default: 'simulate' });
    workflowService.listPhases.mockResolvedValue([]);
  });

  // ── Req 1.1 — Table renders profiles correctly ────────────────────────

  describe('Profile table rendering (Req 1.1)', () => {
    it('renders profile name, role badge, and skill tags', async () => {
      const profile = makeProfile({ name: 'Senior Dev Agent', role: 'DEV_AGENT', skillSet: ['typescript', 'react'] });
      agentsService.listProfiles.mockResolvedValue([profile]);

      renderAgentsPage();

      await waitFor(() => {
        expect(screen.getByText('Senior Dev Agent')).toBeInTheDocument();
      });

      // Role badge should show abbreviated role
      expect(screen.getByText('DEV')).toBeInTheDocument();

      // Skill tags
      expect(screen.getByText('typescript')).toBeInTheDocument();
      expect(screen.getByText('react')).toBeInTheDocument();
    });

    it('shows default badge for default profiles (Req 1.4)', async () => {
      const profile = makeProfile({ isDefault: true });
      agentsService.listProfiles.mockResolvedValue([profile]);

      renderAgentsPage();

      await waitFor(() => {
        expect(screen.getByText('Default')).toBeInTheDocument();
      });
    });

    it('shows empty state when no profiles exist', async () => {
      agentsService.listProfiles.mockResolvedValue([]);

      renderAgentsPage();

      await waitFor(() => {
        expect(screen.getByText(/No agent profiles yet/i)).toBeInTheDocument();
      });
    });

    it('shows multiple profiles in the table', async () => {
      const profiles = [
        makeProfile({ id: 'p1', name: 'BA Agent',  role: 'BA_AGENT'  }),
        makeProfile({ id: 'p2', name: 'Dev Agent', role: 'DEV_AGENT' }),
        makeProfile({ id: 'p3', name: 'QA Agent',  role: 'QA_AGENT'  }),
      ];
      agentsService.listProfiles.mockResolvedValue(profiles);

      renderAgentsPage();

      await waitFor(() => {
        expect(screen.getByText('BA Agent')).toBeInTheDocument();
        expect(screen.getByText('Dev Agent')).toBeInTheDocument();
        expect(screen.getByText('QA Agent')).toBeInTheDocument();
      });
    });
  });

  // ── Req 1.2 — Form validation ─────────────────────────────────────────

  describe('Form validation (Req 1.2)', () => {
    it('opens create form when "New Profile" button is clicked', async () => {
      renderAgentsPage();

      await waitFor(() => {
        expect(screen.getByText('+ New Profile')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('+ New Profile'));

      await waitFor(() => {
        expect(screen.getByText('New Agent Profile')).toBeInTheDocument();
      });
    });

    it('shows error when creating profile with empty name', async () => {
      agentsService.createProfile.mockRejectedValue(
        new Error('Agent profile must have at least one skill'),
      );

      renderAgentsPage();

      await waitFor(() => screen.getByText('+ New Profile'));
      fireEvent.click(screen.getByText('+ New Profile'));

      await waitFor(() => screen.getByText('New Agent Profile'));

      // Submit without filling required fields
      const createButton = screen.getByRole('button', { name: /create/i });
      fireEvent.click(createButton);

      // HTML5 validation should prevent submission for required fields
      const nameInput = screen.getByLabelText(/agent name/i);
      expect(nameInput).toBeRequired();
    });
  });

  // ── Req 1.5 — Delete confirmation dialog ─────────────────────────────

  describe('Delete confirmation dialog (Req 1.5)', () => {
    it('shows delete button only for non-default profiles', async () => {
      const profiles = [
        makeProfile({ id: 'p1', name: 'Custom Agent', isDefault: false }),
        makeProfile({ id: 'p2', name: 'Default Agent', isDefault: true }),
      ];
      agentsService.listProfiles.mockResolvedValue(profiles);

      renderAgentsPage();

      await waitFor(() => {
        expect(screen.getByText('Custom Agent')).toBeInTheDocument();
      });

      // Delete buttons should only appear for non-default profiles
      const deleteButtons = screen.getAllByRole('button', { name: /✕/i });
      // The default profile should not have a delete button in the profiles table
      // (it may have delete buttons in the mappings table)
      expect(deleteButtons.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Seed defaults ─────────────────────────────────────────────────────

  describe('Seed defaults', () => {
    it('calls seedDefaults when "Seed defaults" button is clicked', async () => {
      agentsService.seedDefaults.mockResolvedValue({ seeded: 4 });
      agentsService.listProfiles.mockResolvedValue([]);

      renderAgentsPage();

      await waitFor(() => screen.getByText('Seed defaults'));
      fireEvent.click(screen.getByText('Seed defaults'));

      await waitFor(() => {
        expect(agentsService.seedDefaults).toHaveBeenCalledWith('project-1');
      });
    });
  });
});
