import { logger } from '../../../logger';
import type { RangeStrategy } from '../../../types/versioning';
import { api as npm } from '../npm';
import type { NewValueConfig, VersioningApi } from '../types';
import { hashicorp2npm, npm2hashicorp } from './convertor';

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

function isLessThanRange(version: string, range: string): boolean {
  return !!npm.isLessThanRange?.(version, hashicorp2npm(range));
}

export function isValid(input: string): boolean {
  if (input) {
    try {
      return npm.isValid(hashicorp2npm(input));
    } catch (err) {
      logger.trace({ value: input }, 'Unsupported hashicorp versioning value');
      return false;
    }
  }
  return false;
}

function matches(version: string, range: string): boolean {
  return isValid(range) && npm.matches(version, hashicorp2npm(range));
}

function getSatisfyingVersion(
  versions: string[],
  range: string
): string | null {
  return npm.getSatisfyingVersion(versions, hashicorp2npm(range));
}

function minSatisfyingVersion(
  versions: string[],
  range: string
): string | null {
  return npm.minSatisfyingVersion(versions, hashicorp2npm(range));
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
  isLessThanRange,
  isValid,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
};

// eslint-disable-next-line @typescript-eslint/unbound-method
export const { isVersion } = api;

export default api;
