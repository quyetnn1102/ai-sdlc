import { useTranslation } from 'react-i18next';

export function GatesPage() {
  const { t } = useTranslation();

  return (
    <div>
      <h1 className="text-lg font-semibold text-text-primary mb-6">
        {t('projects.gates')}
      </h1>

      {/* Gates table */}
      <div className="rounded-xl bg-bg-surface border border-border-subtle overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default">
              <th className="text-left px-4 py-3 text-xs uppercase text-text-secondary font-medium tracking-wide">
                Phase
              </th>
              <th className="text-left px-4 py-3 text-xs uppercase text-text-secondary font-medium tracking-wide">
                Rule
              </th>
              <th className="text-left px-4 py-3 text-xs uppercase text-text-secondary font-medium tracking-wide">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border-subtle hover:bg-bg-hover transition-colors">
              <td className="px-4 py-3 text-sm text-text-primary">In Review</td>
              <td className="px-4 py-3 text-sm text-text-primary">Coverage &ge; 80%</td>
              <td className="px-4 py-3">
                <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-[#22C55E20] text-status-success border border-[#22C55E40]">
                  Pass
                </span>
              </td>
            </tr>
            <tr className="border-b border-border-subtle hover:bg-bg-hover transition-colors">
              <td className="px-4 py-3 text-sm text-text-primary">In Test</td>
              <td className="px-4 py-3 text-sm text-text-primary">No critical SonarQube issues</td>
              <td className="px-4 py-3">
                <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-[#EF444420] text-status-danger border border-[#EF444440]">
                  Fail
                </span>
              </td>
            </tr>
            <tr className="hover:bg-bg-hover transition-colors">
              <td className="px-4 py-3 text-sm text-text-primary">Ready for Release</td>
              <td className="px-4 py-3 text-sm text-text-primary">CI integration-tests pass</td>
              <td className="px-4 py-3">
                <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-[#6B728020] text-status-neutral border border-[#6B728040]">
                  Pending
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
