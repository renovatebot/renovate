import { regEx } from '../../util/regex';
import { api as npm } from '../npm';
import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'hashicorp';
export const displayName = 'Hashicorp';
export const urls = [
  'https://www.terraform.io/docs/configuration/terraform.html#specifying-a-required-terraform-version',
];
export const supportsRanges = true;
export const supportedRangeStrategies = ['bump', 'extend', 'pin', 'replace'];

function hashicorp2npm(input: string): string {
  // The only case incompatible with semver is a "short" ~>, e.g. ~> 1.2
  return input.replace(regEx(/~>(\s*\d+\.\d+$)/), '^$1').replace(',', '');
}

const isLessThanRange = (version: string, range: string): boolean =>
  npm.isLessThanRange(hashicorp2npm(version), hashicorp2npm(range));

export const isValid = (input: string): string | boolean =>
  input && npm.isValid(hashicorp2npm(input));

const matches = (version: string, range: string): boolean =>
  npm.matches(hashicorp2npm(version), hashicorp2npm(range));

const getSatisfyingVersion = (versions: string[], range: string): string =>
  npm.getSatisfyingVersion(versions.map(hashicorp2npm), hashicorp2npm(range));

const minSatisfyingVersion = (versions: string[], range: string): string =>
  npm.minSatisfyingVersion(versions.map(hashicorp2npm), hashicorp2npm(range));

function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  newVersion,
}: NewValueConfig): string {
  if (['replace', 'update-lockfile'].includes(rangeStrategy)) {
    if (
      regEx(/~>\s*0\.\d+/).test(currentValue) &&
      npm.getMajor(newVersion) === 0
    ) {
      const testFullVersion = regEx(/(~>\s*0\.)(\d+)\.\d$/);
      let replaceValue = '';
      if (testFullVersion.test(currentValue)) {
        replaceValue = `$<prefix>${npm.getMinor(newVersion)}.0`;
      } else {
        replaceValue = `$<prefix>${npm.getMinor(newVersion)}$<suffix>`;
      }
      return currentValue.replace(
        regEx(`(?<prefix>~>\\s*0\\.)\\d+(?<suffix>.*)$`),
        replaceValue
      );
    }
    // handle special ~> 1.2 case
    if (regEx(/(~>\s*)\d+\.\d+$/).test(currentValue)) {
      return currentValue.replace(
        regEx(`(?<prefix>~>\\s*)\\d+\\.\\d+$`),
        `$<prefix>${npm.getMajor(newVersion)}.0`
      );
    }
  }
  return npm.getNewValue({
    currentValue,
    rangeStrategy,
    currentVersion,
    newVersion,
  });
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
