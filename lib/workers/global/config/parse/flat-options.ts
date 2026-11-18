import { flatDependencyDashboardOptions } from '../../../../config/migrations/custom/dependency-dashboard-migration.ts';
import type { RenovateOptions } from '../../../../config/types.ts';

export type FlatOptions = Record<
  string,
  { field: string; type: RenovateOptions['type'] }
>;

/**
 * The options which moved into an object, with the flat options they replace.
 */
export const flatOptionsByObject: Record<string, FlatOptions> = {
  dependencyDashboard: flatDependencyDashboardOptions,
};
