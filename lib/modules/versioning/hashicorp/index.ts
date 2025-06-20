import type { SemVer } from 'semver';
import { logger } from '../../../logger';
import type { RangeStrategy } from '../../../types/versioning';
import type { NewValueConfig, VersioningApi } from '../types';
import type { Constraint } from './constraint';
import { ConstraintOperator, Constraints } from './constraint';
import { Version } from './version';

export const id = 'hashicorp';
export const displayName = 'Hashicorp';
export const urls = [
  'https://www.terraform.io/docs/configuration/terraform.html#specifying-a-required-terraform-version',
];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = [
  'bump',
  'widen',
  'pin',
  'replace',
];

function parseVersion(input: string | undefined | null): Version | null {
  if (!input) {
    return null;
  }
  try {
    return new Version(input);
  } catch (e) {
    logger.debug({ error: e }, 'Invalid hashicorp version');
    return null;
  }
}

function highLowConstraints(
  constraints: Constraints,
): [Constraint | null, Constraint | null] {
  let high = null;
  let low = null;
  for (const constraint of constraints.constraintsList) {
    high = high ?? constraint;
    low = low ?? constraint;

    if (constraint.check?.isLessThan(low.check)) {
      low = constraint;
    } else if (constraint.check?.isGreaterThan(high.check)) {
      high = constraint;
    }
  }
  return [high, low];
}

function parseConstraints(
  input: string | undefined | null,
): Constraints | null {
  if (!input) {
    return null;
  }
  try {
    return new Constraints(input);
  } catch (e) {
    logger.debug({ error: e }, 'Invalid hashicorp constraint');
    return null;
  }
  return null;
}

class HashicorpVersioningApi implements VersioningApi {
  isValid(input: string): boolean {
    const version = parseVersion(input);
    const constraints = parseConstraints(input);

    if (version || constraints) {
      return true;
    }
    return false;
  }

  isVersion(input: string | undefined | null): boolean {
    return !!parseVersion(input);
  }

  isSingleVersion(input: string): boolean {
    const version = parseVersion(input);
    if (version) {
      return true;
    }

    const constraints = parseConstraints(input);

    if (!constraints) {
      return false;
    }
    if (constraints.length > 1) {
      return false;
    }

    const constraint = constraints.constraintsList[0];
    if (constraint.operator === ConstraintOperator.Equal) {
      return true;
    }

    return false;
  }

  isStable(version: string): boolean {
    const parsedVersion = parseVersion(version);
    if (parsedVersion) {
      return !parsedVersion.prerelease;
    }

    if (!this.isSingleVersion(version)) {
      return false;
    }

    const constraints = parseConstraints(version);
    const constraint = constraints!.constraintsList[0];

    return !constraint.check!.prerelease;
  }

  isCompatible(version: string, _current?: string): boolean {
    return this.isValid(version);
  }

  getMajor(version: string | SemVer): null | number {
    const parsedVersion = parseVersion(version as string);
    if (!parsedVersion) {
      return null;
    }
    return parsedVersion.segments.length > 0 ? parsedVersion.segments[0] : null;
  }

  getMinor(version: string | SemVer): null | number {
    const parsedVersion = parseVersion(version as string);
    if (!parsedVersion) {
      return null;
    }
    return parsedVersion.segments.length > 1 ? parsedVersion.segments[1] : null;
  }

  getPatch(version: string | SemVer): null | number {
    const parsedVersion = parseVersion(version as string);
    if (!parsedVersion) {
      return null;
    }
    return parsedVersion.segments.length > 2 ? parsedVersion.segments[2] : null;
  }

  equals(version: string, other: string): boolean {
    const parsedVersion = parseVersion(version);
    const parsedOther = parseVersion(other);
    if (!parsedVersion || !parsedOther) {
      return false;
    }
    return parsedVersion.compare(parsedOther) === 0;
  }

  isGreaterThan(version: string, other: string): boolean {
    const parsedVersion = parseVersion(version);
    const parsedOther = parseVersion(other);
    if (!parsedVersion || !parsedOther) {
      return false;
    }
    return parsedVersion.compare(parsedOther) > 0;
  }

  isLessThanRange(version: string, range: string): boolean {
    const parsedVersion = parseVersion(version);
    if (!parsedVersion) {
      return false;
    }
    const secondVersion = parseVersion(range);
    if (secondVersion) {
      return parsedVersion.compare(secondVersion) < 0;
    }

    const constraints = parseConstraints(range);
    if (!constraints) {
      return false;
    }
    if (constraints.length === 0) {
      return false;
    }

    if (constraints.check(parsedVersion)) {
      return false;
    }

    // Internally sort the constraints
    constraints.sort();

    const [high, low] = highLowConstraints(constraints);

    if (
      low?.operator === ConstraintOperator.LessThan ||
      low?.operator === ConstraintOperator.LessThanOrEqual
    ) {
      return false;
    }

    if (
      high?.operator === ConstraintOperator.LessThan &&
      parsedVersion.isGreaterThanOrEqual(high?.check)
    ) {
      return false;
    } else if (
      high?.operator === ConstraintOperator.LessThanOrEqual &&
      parsedVersion.isGreaterThan(high?.check)
    ) {
      return false;
    }

    if (
      high?.operator === ConstraintOperator.Pessimistic &&
      parsedVersion.isGreaterThanOrEqual(high?.check)
    ) {
      return false;
    }
    if (
      low?.operator === ConstraintOperator.Pessimistic &&
      parsedVersion.isGreaterThanOrEqual(low?.check)
    ) {
      return false;
    }

    return true;
  }

  getSatisfyingVersion(versions: string[], range: string): string | null {
    let versionsInRange: Version[] = [];

    const filteredVersions = versions
      .map((version: string) => parseVersion(version))
      .filter((version: Version | null) => version !== null);

    const parsedRange = parseConstraints(range);
    if (parsedRange) {
      versionsInRange = filteredVersions
        .filter((version) => {
          return parsedRange.check(version);
        })
        .sort((a, b) => a.compare(b));

      return versionsInRange[versionsInRange.length - 1]?.toString() ?? null;
    }

    const parsedVersion = parseVersion(range);
    if (parsedVersion) {
      versionsInRange = filteredVersions
        .filter((version) => {
          return parsedVersion.compare(version) === 0;
        })
        .sort((a, b) => a.compare(b));
    }

    return versionsInRange[versionsInRange.length - 1]?.toString() ?? null;
  }

  minSatisfyingVersion(versions: string[], range: string): string | null {
    let versionsInRange: Version[] = [];

    const filteredVersions = versions
      .map((version: string) => parseVersion(version))
      .filter((version: Version | null) => version !== null);

    const parsedRange = parseConstraints(range);
    if (parsedRange) {
      versionsInRange = filteredVersions
        .filter((version) => {
          return parsedRange.check(version);
        })
        .sort((a, b) => a.compare(b));

      return versionsInRange[0]?.toString() ?? null;
    }

    const parsedVersion = parseVersion(range);
    if (parsedVersion) {
      versionsInRange = filteredVersions
        .filter((version) => {
          return parsedVersion.compare(version) === 0;
        })
        .sort((a, b) => a.compare(b));
    }

    return versionsInRange[0]?.toString() ?? null;
  }

  getNewValue({
    currentValue,
    rangeStrategy,
    currentVersion,
    newVersion,
    isReplacement,
  }: NewValueConfig): string | null {
    const parsedNewVersion = parseVersion(newVersion);
    if (!parsedNewVersion) {
      return null;
    }

    const constraints = parseConstraints(currentValue);
    if (!constraints) {
      return null;
    }

    if (this.isLessThanRange(newVersion, currentValue)) {
      return currentValue;
    }

    const [high] = highLowConstraints(constraints);

    if (high === null) {
      return null;
    }

    if (
      (rangeStrategy === 'bump' &&
        high.operator === ConstraintOperator.Pessimistic) ||
      rangeStrategy === 'widen'
    ) {
      high.check = parsedNewVersion;
      return constraints.toString();
    }

    if (high.check === null) {
      return null;
    }

    const currentHighVersion = high.check;
    const targetVersion = new Version(
      `${parsedNewVersion.prefix}${parsedNewVersion.major}.${parsedNewVersion.minor}.0`,
      currentHighVersion.si,
    );
    high.check = targetVersion;

    return constraints.toString();
  }

  sortVersions(version: string, other: string): number {
    const parserdVersion = parseVersion(version);
    const parsedOther = parseVersion(other);
    if (!parserdVersion || !parsedOther) {
      return 0;
    }
    return parserdVersion.compare(parsedOther);
  }

  matches(version: string, range: string): boolean {
    const parsedVersion = parseVersion(version);
    if (!parsedVersion) {
      return false;
    }
    const parsedRange = parseConstraints(range);
    if (parsedRange) {
      return parsedRange.check(parsedVersion);
    }
    const parsedVersionRange = parseVersion(range);
    if (!parsedVersionRange) {
      return false;
    }
    return parsedVersion.compare(parsedVersionRange) === 0;
  }
}

export const api: VersioningApi = new HashicorpVersioningApi();

export default api;
