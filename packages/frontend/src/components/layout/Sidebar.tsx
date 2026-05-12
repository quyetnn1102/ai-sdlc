import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface NavItem {
  path: string;
  labelKey: string;
  icon: React.ReactNode;
  end?: boolean;
}

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
      <rect x="1" y="1" width="6" height="6" rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="9" y="1" width="6" height="6" rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="1" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.7"/>
      <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.7"/>
    </svg>
  );
}
function BuildingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
      <path d="M2 14V4l6-2 6 2v10H2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none"/>
      <rect x="6" y="10" width="4" height="4" fill="currentColor" opacity="0.6"/>
      <rect x="4" y="6" width="2" height="2" fill="currentColor" opacity="0.6"/>
      <rect x="10" y="6" width="2" height="2" fill="currentColor" opacity="0.6"/>
    </svg>
  );
}
function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
      <path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

const navItems: NavItem[] = [
  { path: '/dashboard', labelKey: 'nav.dashboard', icon: <GridIcon />, end: true },
  { path: '/organizations', labelKey: 'nav.organizations', icon: <BuildingIcon /> },
];

function NavItemLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.path}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 px-3 h-9 rounded-[6px] text-[13px] transition-colors duration-[120ms]',
          isActive
            ? 'bg-accent-subtle text-text-primary border-l-2 border-accent-primary pl-[10px]'
            : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
        )
      }
    >
      {item.icon}
      <span>{item.labelKey}</span>
    </NavLink>
  );
}

export function Sidebar() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <aside className="flex flex-col w-[240px] h-screen border-r bg-bg-surface border-border-subtle shrink-0">
      {/* Logo */}
      <div className="flex items-center h-14 px-4 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-accent-primary flex items-center justify-center">
            <span className="text-white text-xs font-bold">S</span>
          </div>
          <span className="text-[15px] font-semibold text-text-primary">{t('app.name')}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-widest text-text-disabled">
          Menu
        </p>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 px-3 h-9 rounded-[6px] text-[13px] transition-colors duration-[120ms]',
                isActive
                  ? 'bg-accent-subtle text-text-primary border-l-2 border-accent-primary pl-[10px]'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
              )
            }
          >
            {item.icon}
            <span>{t(item.labelKey)}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom: user + logout */}
      <div className="border-t border-border-subtle p-2 space-y-0.5">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 px-3 h-9 rounded-[6px] text-[13px] transition-colors',
              isActive
                ? 'bg-accent-subtle text-text-primary border-l-2 border-accent-primary pl-[10px]'
                : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
            )
          }
        >
          <GearIcon />
          <span>{t('nav.settings')}</span>
        </NavLink>

        {user && (
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-6 h-6 rounded-full bg-accent-subtle border border-accent-primary/30 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-semibold text-accent-primary">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text-primary truncate">{user.name}</p>
              <p className="text-[11px] text-text-disabled truncate">{user.email}</p>
            </div>
            <button
              onClick={handleLogout}
              title={t('nav.logout')}
              className="text-text-disabled hover:text-status-danger transition-colors"
            >
              <LogoutIcon />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
