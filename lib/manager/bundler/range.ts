import { SemVer, parseRange } from 'semver-utils';
import type { RangeStrategy } from '../../types';
import type { RangeConfig } from '../types';

/*
 * The getRangeStrategy() function is optional and can be removed if not applicable.
 * It is used when the user configures rangeStrategy=auto.
 *
 * For example in npm, when rangeStrategy is auto we:
 *  - Always pin "devDependencies"
 *  - Pin "dependencies" only if we detect that it's probably an app not a library
 *  - Always widen "peerDependencies"
 *
 * If this function is not present then the default 'replace' value will be used.
 *
 */
export function getRangeStrategy(config: RangeConfig): RangeStrategy {
  const { currentValue, rangeStrategy } = config;

  if (rangeStrategy === 'auto') {
    const semVersions = parseRange(currentValue);
    if (semVersions.length === 1 && defaultRange(semVersions[0])) {
      // default range ('>= 0') indicates the need for staying at the latest version.
      return 'update-lockfile';
    }

    return 'replace';
  }

  return rangeStrategy;
}

function defaultRange(v: SemVer): boolean {
  if (
    v.operator === '>=' &&
    v.major === '0' &&
    v.minor === undefined &&
    v.patch === undefined
  ) {
    return true;
  }
  return false;
}
