import { logger } from '../../../logger/index.ts';
import { api as npm } from './index.ts';
import type { NpmRangeApi, WrapNpmRangesConfig } from './types.ts';

function passthrough(version: string): string {
  return version;
}

/**
 * Builds the range-handling part of a versioning API for modules whose ranges
 * can be expressed as npm ranges, so that each of them only has to supply the
 * conversion functions instead of re-implementing the same delegators.
 */
export function wrapNpmRanges(config: WrapNpmRangesConfig): NpmRangeApi {
  const {
    id,
    toNpmRange,
    toNpmVersion = passthrough,
    onRangeError = 'throw',
  } = config;

  function toNpmVersions(versions: string[]): string[] {
    return versions.map((version) => toNpmVersion(version));
  }

  function isValid(input: string): boolean {
    return npm.isValid(toNpmRange(input));
  }

  function matches(version: string, range: string): boolean {
    return npm.matches(toNpmVersion(version), toNpmRange(range));
  }

  function getSatisfyingVersion(
    versions: string[],
    range: string,
  ): string | null {
    return npm.getSatisfyingVersion(toNpmVersions(versions), toNpmRange(range));
  }

  function minSatisfyingVersion(
    versions: string[],
    range: string,
  ): string | null {
    return npm.minSatisfyingVersion(toNpmVersions(versions), toNpmRange(range));
  }

  function isLessThanRange(version: string, range: string): boolean {
    return npm.isLessThanRange!(toNpmVersion(version), toNpmRange(range));
  }

  function subset(subRange: string, superRange: string): boolean | undefined {
    if (onRangeError === 'throw') {
      return npm.subset!(toNpmRange(subRange), toNpmRange(superRange));
    }

    try {
      return npm.subset!(toNpmRange(subRange), toNpmRange(superRange));
    } catch (err) {
      logger.debug({ err }, `${id}.subset error`);
      return false;
    }
  }

  function intersects(subRange: string, superRange: string): boolean {
    if (onRangeError === 'throw') {
      return npm.intersects!(toNpmRange(subRange), toNpmRange(superRange));
    }

    try {
      return npm.intersects!(toNpmRange(subRange), toNpmRange(superRange));
    } catch (err) {
      logger.debug({ err }, `${id}.intersects error`);
      return false;
    }
  }

  return {
    isValid,
    matches,
    getSatisfyingVersion,
    minSatisfyingVersion,
    isLessThanRange,
    subset,
    intersects,
  };
}
