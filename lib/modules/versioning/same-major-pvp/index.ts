import { regEx } from '../../../util/regex';
import { api as semverCoerced } from '../semver-coerced';
import { logger } from '../../../logger';
import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'same-major-pvp';
export const displayName = 'Same Major PVP Versioning';
export const urls = [];
export const supportsRanges = false;

/**
 *
 * Converts input to range if it's a version. eg. X.Y.Z -> '>=X.Y.Z <X+1'
 * If the input is already a range, it returns the input.
 */
function massageVersion(input: string): string {
  const r = regEx(/^(?<majorOne>\d+)\.(?<majorTwo>\d+)/);
  const m = r.exec(input);
  if (!m?.groups) return input;

  const majorPlusOne = m.groups['majorOne'] + "." + (parseInt(m.groups['majorTwo'],10) + 1).toFixed(0);

  const ret = `>=${input} <${majorPlusOne}`;
  logger.info({input, majorPlusOne, ret}, "massageVersion");
  return ret;
}

// for same major versioning one version is greater than the other if its major is greater
function isGreaterThan(version: string, other: string): boolean {
  let versionMajor = version.split(".");
  while (versionMajor.length > 2) versionMajor.pop();
  const versionIntMajor = versionMajor.map(x => parseInt(x, 10));

  let otherMajor = other.split(".");
  while (otherMajor.length > 2) otherMajor.pop();
  const otherIntMajor = otherMajor.map(x => parseInt(x, 10));

  logger.info({versionMajor, otherMajor}, "isGreaterThan");

  for (let i = 0; i < Math.min(versionIntMajor.length, otherIntMajor.length); i++) {
    if (versionIntMajor[i] > otherIntMajor[i]) {
      return true;
    }
    if (versionIntMajor[i] < otherIntMajor[i]) {
      return false;
    }
  }

  return false;
}

function matches(version: string, range: string): boolean {
  const massagedRange = massageVersion(range);
  const ret = semverCoerced.matches(version, massagedRange);
  logger.info({version, range, massagedRange, ret}, "matches");
  return ret;
}

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  const massagedRange = massageVersion(range);
  const ret = semverCoerced.getSatisfyingVersion(versions, massagedRange);
  logger.info({versions, massagedRange, ret}, "getSatisfyingVersion");
  return ret;
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  const ret = semverCoerced.minSatisfyingVersion(versions, massageVersion(range));
  logger.info({ret}, "minSatisfyingVersion");
  return ret;
}

function isLessThanRange(version: string, range: string): boolean {
  const ret = semverCoerced.isLessThanRange!(version, massageVersion(range));
  logger.info({ret}, "isLessThanRange");
  return ret;
}

function isCompatible(version: string): boolean {
  logger.info({version}, 'isCompatible');
  return true;
}

function getNewValue({
  currentValue,
  currentVersion,
  newVersion,
}: NewValueConfig): string {
  logger.warn({currentValue, currentVersion, newVersion}, 'pvp/getNewValue');
  let split = currentValue.split(' ');
  if (split.length === 2) {
    const r = regEx(/(?<majorOne>\d+)\.(?<majorTwo>\d+)/);
    const m = r.exec(split[1]);
    if (!m?.groups) {
      logger.warn({}, 'did not find two major parts');
      return newVersion;
    }

    const currentMajor = m.groups['majorOne'] + "." + (parseInt(m.groups['majorTwo'],10)).toFixed(0);
    const majorPlusOne = m.groups['majorOne'] + "." + (parseInt(m.groups['majorTwo'],10) + 1).toFixed(0);
    if (semverCoerced.matches(newVersion, '<' + currentMajor)) {
      // the upper bound is already high enough
      return currentValue;
    } else if (semverCoerced.matches(newVersion, '<' + majorPlusOne)) {
      const res = split[0] + ' <' + majorPlusOne;
      logger.warn({res}, 'pvp/getNewValue result');
      return res;
    } else {
      throw new Error("Even though the major bound was bumped, the newVersion still isn't accepted. Maybe bounds are ancient?");
    }
  } else {
    logger.warn({}, 'did not find two parts');
    return newVersion;
  }
}

export const api: VersioningApi = {
  ...semverCoerced,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
  isLessThanRange,
  isGreaterThan,
  isCompatible,
  getNewValue,
};
export default api;
