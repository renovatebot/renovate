import { getRangeStrategy } from '../../../../modules/manager/index.ts';
import type { RangeStrategy } from '../../../../types/versioning.ts';
import type { LookupUpdateConfig } from './types.ts';

/**
 * Ask the manager which `rangeStrategy` to use, then apply the
 * vulnerability-alert overrides on top of it.
 */
export function resolveRangeStrategy(
  config: LookupUpdateConfig,
): RangeStrategy | null {
  const rangeStrategy = getRangeStrategy(config);

  if (!config.isVulnerabilityAlert) {
    return rangeStrategy;
  }

  // istanbul ignore next
  if (rangeStrategy === 'update-lockfile' && !config.lockedVersion) {
    return 'bump';
  }

  // unconstrained deps with lockedVersion
  if (!config.currentValue && config.lockedVersion) {
    return 'update-lockfile';
  }

  return rangeStrategy;
}
