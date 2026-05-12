import { useTranslation } from 'react-i18next';

export function OrganizationsPage() {
  const { t } = useTranslation();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-text-primary">
          {t('organizations.title')}
        </h1>
        <button className="h-8 px-3 rounded-[6px] bg-accent-primary text-white text-sm font-medium hover:bg-accent-hover transition-colors">
          {t('organizations.create')}
        </button>
      </div>

      {/* Organizations table placeholder */}
      <div className="rounded-xl bg-bg-surface border border-border-subtle overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default">
              <th className="text-left px-4 py-3 text-xs uppercase text-text-secondary font-medium tracking-wide">
                {t('organizations.name')}
              </th>
              <th className="text-left px-4 py-3 text-xs uppercase text-text-secondary font-medium tracking-wide">
                {t('organizations.key')}
              </th>
              <th className="text-left px-4 py-3 text-xs uppercase text-text-secondary font-medium tracking-wide">
                {t('organizations.members')}
              </th>
              <th className="text-left px-4 py-3 text-xs uppercase text-text-secondary font-medium tracking-wide">
                {t('organizations.projects')}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-sm text-text-secondary">
                {t('common.noData')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
