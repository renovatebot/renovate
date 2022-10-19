import type { RangeStrategy } from '../../../types/versioning';
import { regEx } from '../../../util/regex';
import { api as npm } from '../npm';
import type { NewValueConfig, VersioningApi } from '../types';

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

function hashicorp2npm(input: string): string {
  // The only case incompatible with semver is a "short" ~>, e.g. ~> 1.2
  return input.replace(regEx(/~>(\s*\d+\.\d+$)/), '^$1').replace(',', '');
}

function isLessThanRange(version: string, range: string): boolean {
  return !!npm.isLessThanRange?.(hashicorp2npm(version), hashicorp2npm(range));
}

export const isValid = (input: string): boolean =>
  !!input && npm.isValid(hashicorp2npm(input));

const matches = (version: string, range: string): boolean =>
  npm.matches(hashicorp2npm(version), hashicorp2npm(range));

function getSatisfyingVersion(
  versions: string[],
  range: string
): string | null {
  return npm.getSatisfyingVersion(
    versions.map(hashicorp2npm),
    hashicorp2npm(range)
  );
}

function minSatisfyingVersion(
  versions: string[],
  range: string
): string | null {
  return npm.minSatisfyingVersion(
    versions.map(hashicorp2npm),
    hashicorp2npm(range)
  );
}

function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  newVersion,
}: NewValueConfig): string | null {
  if (['replace', 'update-lockfile'].includes(rangeStrategy)) {
    const minor = npm.getMinor(newVersion);
    const major = npm.getMajor(newVersion);
    if (regEx(/~>\s*0\.\d+/).test(currentValue) && major === 0 && minor) {
      const testFullVersion = regEx(/(~>\s*0\.)(\d+)\.\d$/);
      let replaceValue = '';
      if (testFullVersion.test(currentValue)) {
        replaceValue = `$<prefix>${minor}.0`;
      } else {
        replaceValue = `$<prefix>${minor}$<suffix>`;
      }
      return currentValue.replace(
        regEx(`(?<prefix>~>\\s*0\\.)\\d+(?<suffix>.*)$`),
        replaceValue
      );
    }
    // handle special ~> 1.2 case
    if (major && regEx(/(~>\s*)\d+\.\d+$/).test(currentValue)) {
      return currentValue.replace(
        regEx(`(?<prefix>~>\\s*)\\d+\\.\\d+$`),
        `$<prefix>${major}.0`
      );
    }
  }
  let npmNewVersion = npm.getNewValue({
    currentValue,
    rangeStrategy,
    currentVersion,
    newVersion,
  });
  if (
    npmNewVersion &&
    currentValue.startsWith('v') &&
    !npmNewVersion.startsWith('v')
  ) {
    npmNewVersion = `v${npmNewVersion}`;
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
