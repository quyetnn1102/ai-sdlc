import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Tab { path: string; label: string; }

interface TabsNavProps {
  tabs: Tab[];
  className?: string;
}

/** Route-based tab bar using NavLink active state */
export function TabsNav({ tabs, className }: TabsNavProps) {
  return (
    <div className={cn('flex gap-0 border-b border-border-subtle mb-6', className)}>
      {tabs.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          end
          className={({ isActive }) =>
            cn(
              'px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px',
              isActive
                ? 'text-text-primary border-accent-primary'
                : 'text-text-secondary border-transparent hover:text-text-primary hover:border-border-default',
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}

/** In-page state tabs (not route-based) */
interface StaticTabsProps {
  tabs: Array<{ key: string; label: string }>;
  active: string;
  onChange: (key: string) => void;
  className?: string;
}
export function StaticTabs({ tabs, active, onChange, className }: StaticTabsProps) {
  return (
    <div className={cn('flex gap-0 border-b border-border-subtle', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            'px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px',
            active === tab.key
              ? 'text-text-primary border-accent-primary'
              : 'text-text-secondary border-transparent hover:text-text-primary',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
