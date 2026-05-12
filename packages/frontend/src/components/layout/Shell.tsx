import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function Shell() {
  return (
    <div className="flex h-screen overflow-hidden bg-bg-app">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
