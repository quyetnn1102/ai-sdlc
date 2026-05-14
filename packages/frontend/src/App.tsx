import { Routes, Route, Navigate } from 'react-router-dom';
import { Shell } from './components/layout/Shell';
import { PrivateRoute } from './components/auth/PrivateRoute';

// Public pages
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';

// Dashboard
import { DashboardPage } from './pages/Dashboard';

// Organizations
import { OrganizationsPage } from './pages/organizations/List';
import { OrganizationDetailPage } from './pages/organizations/Detail';

// Projects – core
import { ProjectDetailPage } from './pages/projects/Detail';
import { KanbanPage } from './pages/projects/Kanban';
import { WorkflowPage } from './pages/projects/Workflow';
import { GatesPage } from './pages/projects/Gates';
import { SettingsPage } from './pages/projects/Settings';

// Projects – Phase 2 (missing pages)
import { MetricsPage } from './pages/projects/Metrics';
import { TraceabilityPage } from './pages/projects/Traceability';
import { RetrosPage } from './pages/projects/Retros';

// Projects – v3 pages
import { TestsPage } from './pages/projects/Tests';
import { TestPlansPage } from './pages/projects/TestPlans';
import { IncidentsPage } from './pages/projects/Incidents';

// Projects – v4 agent automation
import { AgentsPage } from './pages/projects/Agents';
import { ExecutionsPage } from './pages/projects/Executions';

// Projects – v5 workspace builder
import { WorkspaceBuilder } from './features/workspace/pages/WorkspaceBuilder';
import { EpicRunDetail } from './features/workspace/pages/EpicRunDetail';
import { EpicsListPage } from './features/workspace/pages/EpicsListPage';

export default function App() {
  return (
    <Routes>
      {/* ── Public ───────────────────────────────────────────────── */}
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* ── Protected (requires auth) ────────────────────────────── */}
      <Route element={<PrivateRoute />}>
        <Route element={<Shell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Dashboard */}
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* Organizations */}
          <Route path="/organizations"     element={<OrganizationsPage />} />
          <Route path="/organizations/:id" element={<OrganizationDetailPage />} />

          {/* Project – detail landing */}
          <Route path="/projects/:id" element={<ProjectDetailPage />} />

          {/* Project – feature tabs */}
          <Route path="/projects/:id/kanban"    element={<KanbanPage />} />
          <Route path="/projects/:id/workflow"  element={<WorkflowPage />} />
          <Route path="/projects/:id/gates"     element={<GatesPage />} />
          <Route path="/projects/:id/metrics"   element={<MetricsPage />} />
          <Route path="/projects/:id/trace"     element={<TraceabilityPage />} />
          <Route path="/projects/:id/retros"    element={<RetrosPage />} />
          <Route path="/projects/:id/tests"     element={<TestsPage />} />
          <Route path="/projects/:id/test-plans" element={<TestPlansPage />} />
          <Route path="/projects/:id/incidents" element={<IncidentsPage />} />
          <Route path="/projects/:id/agents"    element={<AgentsPage />} />
          <Route path="/projects/:id/executions" element={<ExecutionsPage />} />
          <Route path="/projects/:id/workspace"  element={<WorkspaceBuilder />} />
          <Route path="/projects/:id/workspace/epics" element={<EpicsListPage />} />
          <Route path="/projects/:id/workspace/runs/:runId" element={<EpicRunDetail />} />
          <Route path="/projects/:id/settings"  element={<SettingsPage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
