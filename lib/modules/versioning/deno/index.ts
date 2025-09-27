import semver from 'semver';
import type { RangeStrategy } from '../../../types/versioning';
import { api as npm } from '../npm';
import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'deno';
export const displayName = 'deno';
export const urls = [
  'https://docs.deno.com/runtime/fundamentals/modules/#package-versions',
];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = [
  'bump',
  'pin',
  'replace',
];

const { validRange } = semver;

// If this is left as an alias, inputs like "17.04.0" throw errors
export const isValid = (input: string): boolean => {
  // Allow "latest" as a valid version
  // https://github.com/denoland/deno_semver/blob/fe7c48e72e09116d17a64f9e58e6b28d1669b8e5/src/npm.rs#L1486
  if (input === 'latest') {
    return true;
  }
  // the other, see the following test cases
  // https://github.com/denoland/deno_semver/blob/fe7c48e72e09116d17a64f9e58e6b28d1669b8e5/src/npm.rs#L621

  return !!validRange(input);
};

export function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  newVersion,
  isReplacement,
}: NewValueConfig): string | null {
  if (currentValue === 'latest') {
    if (rangeStrategy === 'bump' || rangeStrategy === 'widen') {
      return null;
    }
    if (rangeStrategy === 'replace' || rangeStrategy === 'pin') {
      return newVersion;
    }
    if (rangeStrategy === 'update-lockfile') {
      return currentValue; // keep "latest" as is
    }
  }
  return npm.getNewValue({
    currentValue,
    rangeStrategy,
    currentVersion,
    newVersion,
    isReplacement,
  });
}

export const api: VersioningApi = {
  ...npm,
  isValid,
  getNewValue,
};

export default api;
