/**
 * Workspace feature route definitions.
 * Exports route config for integration into the main App router.
 */
import { type RouteObject } from 'react-router-dom';
import { WorkspaceBuilder } from './pages/WorkspaceBuilder';
import { EpicRunDetail } from './pages/EpicRunDetail';
import { EpicsListPage } from './pages/EpicsListPage';

/**
 * Route definitions for the workspace feature.
 * These should be added under the project-scoped protected routes.
 *
 * Usage in App.tsx:
 *   import { workspaceRoutes } from '@/features/workspace/routes';
 *   // Inside <Routes>:
 *   {workspaceRoutes.map(route => <Route key={route.path} {...route} />)}
 */
export const workspaceRoutes: RouteObject[] = [
  {
    path: '/projects/:id/workspace',
    element: <WorkspaceBuilder />,
  },
  {
    path: '/projects/:id/workspace/epics',
    element: <EpicsListPage />,
  },
  {
    path: '/projects/:id/workspace/runs/:runId',
    element: <EpicRunDetail />,
  },
];

/**
 * Navigation entry for the project sidebar.
 */
export const workspaceNavEntry = {
  label: 'Workspace',
  path: 'workspace',
  icon: '⚡',
};
