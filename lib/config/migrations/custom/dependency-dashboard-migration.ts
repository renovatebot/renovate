import { isBoolean, isNullOrUndefined, isPlainObject } from '@sindresorhus/is';
import type { DependencyDashboardConfig } from '../../types.ts';
import { AbstractMigration } from '../base/abstract-migration.ts';

const dependencyDashboardFields: Record<
  string,
  keyof DependencyDashboardConfig
> = {
  customizeDashboard: 'customize',
  dependencyDashboardAutoclose: 'autoclose',
  dependencyDashboardFooter: 'footer',
  dependencyDashboardHeader: 'header',
  dependencyDashboardLabels: 'labels',
  dependencyDashboardOSVVulnerabilitySummary: 'osvVulnerabilitySummary',
  dependencyDashboardReportAbandonment: 'reportAbandonment',
  dependencyDashboardTitle: 'title',
};

/**
 * Converts a `dependencyDashboard` value from before it was an object, including the strings which were accepted for the boolean.
 *
 * Returns `undefined` for a value which can't be converted, so it's left for validation to report.
 */
function toObject(value: unknown): Record<string, unknown> | undefined {
  if (isNullOrUndefined(value)) {
    return {};
  }
  if (isPlainObject(value)) {
    return { ...value };
  }
  if (isBoolean(value) || value === 'true' || value === 'false') {
    return { enabled: value === true || value === 'true' };
  }
  return undefined;
}

export class DependencyDashboardMigration extends AbstractMigration {
  override readonly propertyName =
    // oxlint-disable-next-line renovate/require-regex-util -- must stay a native RegExp: MigrationsService matches propertyName via isRegExp(), which RE2 instances fail
    /^(?:customizeDashboard|dependencyDashboard(?:Autoclose|Footer|Header|Labels|OSVVulnerabilitySummary|ReportAbandonment|Title)?)$/;

  override run(value: unknown, key: string): void {
    const dependencyDashboard = toObject(this.get('dependencyDashboard'));
    if (!dependencyDashboard) {
      return;
    }

    if (key !== 'dependencyDashboard') {
      dependencyDashboard[dependencyDashboardFields[key]] ??= value;
      this.delete(key);
    }
    this.setHard('dependencyDashboard', dependencyDashboard);
  }
}
