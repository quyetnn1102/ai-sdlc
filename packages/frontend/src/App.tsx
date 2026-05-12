import { Routes, Route, Navigate } from 'react-router-dom';
import { Shell } from './components/layout/Shell';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { DashboardPage } from './pages/Dashboard';
import { OrganizationsPage } from './pages/organizations/List';
import { OrganizationDetailPage } from './pages/organizations/Detail';
import { ProjectDetailPage } from './pages/projects/Detail';
import { KanbanPage } from './pages/projects/Kanban';
import { WorkflowPage } from './pages/projects/Workflow';
import { GatesPage } from './pages/projects/Gates';
import { SettingsPage } from './pages/projects/Settings';

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected routes - wrapped in Shell */}
      <Route element={<Shell />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/organizations" element={<OrganizationsPage />} />
        <Route path="/organizations/:id" element={<OrganizationDetailPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/projects/:id/kanban" element={<KanbanPage />} />
        <Route path="/projects/:id/workflow" element={<WorkflowPage />} />
        <Route path="/projects/:id/gates" element={<GatesPage />} />
        <Route path="/projects/:id/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
