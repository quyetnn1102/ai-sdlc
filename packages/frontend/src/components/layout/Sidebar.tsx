import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const navItems = [
  { path: '/dashboard', label: 'nav.dashboard', icon: '□' },
  { path: '/organizations', label: 'nav.organizations', icon: '◇' },
];

export function Sidebar() {
  const { t } = useTranslation();

  return (
    <aside
      className="flex flex-col w-[240px] h-screen border-r bg-bg-surface border-border-subtle"
    >
      {/* Logo / App Name */}
      <div className="flex items-center h-14 px-4 border-b border-border-subtle">
        <span className="text-[15px] font-semibold text-text-primary">
          {t('app.name')}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 px-2 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 h-9 rounded-[6px] text-[13px] transition-colors duration-[120ms] ${
                isActive
                  ? 'bg-accent-subtle text-text-primary border-l-2 border-accent-primary'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            <span>{t(item.label)}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="p-2 border-t border-border-subtle">
        <NavLink
          to="/settings"
          className="flex items-center gap-3 px-3 h-9 rounded-[6px] text-[13px] text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors duration-[120ms]"
        >
          <span className="text-base">⚙</span>
          <span>{t('nav.settings')}</span>
        </NavLink>
      </div>
    </aside>
  );
}
