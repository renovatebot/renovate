import { logger } from '../../../logger/index.ts';
import type { RangeStrategy } from '../../../types/versioning.ts';
import { getExcludedVersions, getFilteredRange } from '../common.ts';
import { api as npm } from '../npm/index.ts';
import { wrapNpmRanges } from '../npm/wrap.ts';
import type { NewValueConfig, VersioningApi } from '../types.ts';
import { hashicorp2npm, npm2hashicorp } from './convertor.ts';

export const id = 'hashicorp';
export const displayName = 'Hashicorp';
export const urls = [
  '[Terraform - Specifying a required version](https://www.terraform.io/docs/configuration/terraform.html#specifying-a-required-terraform-version)',
];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = [
  'bump',
  'widen',
  'replace',
];

const npmRanges = wrapNpmRanges({ id, toNpmRange: hashicorp2npm });

export function isValid(input: string): boolean {
  if (input) {
    try {
      return npm.isValid(hashicorp2npm(input));
    } catch {
      logger.trace({ value: input }, 'Unsupported hashicorp versioning value');
      return false;
    }
  }
  return false;
}

function matches(version: string, range: string): boolean {
  const excludedVersions = getExcludedVersions(range);
  if (excludedVersions.includes(version)) {
    return false;
  }

  const filteredRange = getFilteredRange(range);
  return isValid(filteredRange) && npmRanges.matches(version, filteredRange);
}

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  const excludedVersions = getExcludedVersions(range);
  const filteredRange = getFilteredRange(range);
  const filteredVersions = versions.filter(
    (version) => !excludedVersions.includes(version),
  );

  return npmRanges.getSatisfyingVersion(filteredVersions, filteredRange);
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  const excludedVersions = getExcludedVersions(range);
  const filteredRange = getFilteredRange(range);
  const filteredVersions = versions.filter(
    (version) => !excludedVersions.includes(version),
  );
  return npmRanges.minSatisfyingVersion(filteredVersions, filteredRange);
}

function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  newVersion,
}: NewValueConfig): string | null {
  let npmNewVersion = npm.getNewValue({
    currentValue: hashicorp2npm(currentValue),
    rangeStrategy,
    currentVersion,
    newVersion,
  });
  if (npmNewVersion) {
    npmNewVersion = npm2hashicorp(npmNewVersion);
    if (currentValue.startsWith('v') && !npmNewVersion.startsWith('v')) {
      npmNewVersion = `v${npmNewVersion}`;
    }
  }
  return npmNewVersion;
}

export const api: VersioningApi = {
  ...npm,
  isLessThanRange: npmRanges.isLessThanRange,
  isValid,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
};

// oxlint-disable-next-line typescript/unbound-method
export const { isVersion } = api;

export default api;
