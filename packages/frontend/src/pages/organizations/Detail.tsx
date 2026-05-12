import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function OrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  return (
    <div>
      <h1 className="text-lg font-semibold text-text-primary mb-6">
        Organization Detail
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projects */}
        <div className="p-5 rounded-xl bg-bg-surface border border-border-subtle">
          <h2 className="text-md font-medium text-text-primary mb-4">
            {t('organizations.projects')}
          </h2>
          <p className="text-sm text-text-secondary">{t('common.noData')}</p>
        </div>

        {/* Members */}
        <div className="p-5 rounded-xl bg-bg-surface border border-border-subtle">
          <h2 className="text-md font-medium text-text-primary mb-4">
            {t('organizations.members')}
          </h2>
          <p className="text-sm text-text-secondary">{t('common.noData')}</p>
        </div>
      </div>
    </div>
  );
}
