import { DateTime } from 'luxon';
import { valid } from 'semver';
import npm, { isVersion } from '../npm';
import type { NewValueConfig, VersioningApi } from '../types';
import { findScheduleForCodename, findScheduleForVersion } from './schedule';

export const id = 'node';
export const displayName = 'Node.js';
export const urls = [];
export const supportsRanges = false;

function normalizeValue(value: string): string {
  const schedule = findScheduleForCodename(value);
  if (schedule) {
    const major = schedule.version.replace('v', '');
    return `^${major}`;
  }
  return value;
}

function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  newVersion,
}: NewValueConfig): string | null {
  // Try to use codename if the current value is a codename
  if (rangeStrategy !== 'pin' && findScheduleForCodename(currentValue)) {
    const newSchedule = findScheduleForVersion(newVersion);
    if (newSchedule?.codename) {
      return newSchedule.codename.toLowerCase();
    }
  }
  const res = npm.getNewValue({
    currentValue: normalizeValue(currentValue),
    rangeStrategy,
    currentVersion,
    newVersion,
  });
  if (res && isVersion(res)) {
    // normalize out any 'v' prefix
    return valid(res);
  }
  return res;
}

export function isValid(version: string): boolean {
  return npm.isValid(normalizeValue(version));
}

export function isStable(version: string): boolean {
  if (npm.isStable(version)) {
    const schedule = findScheduleForVersion(version);
    if (schedule?.lts) {
      // TODO: use the exact release that started LTS (#9716)
      return DateTime.local() > DateTime.fromISO(schedule.lts);
    }
  }
  return false;
}

export function matches(version: string, range: string): boolean {
  return npm.matches(version, normalizeValue(range));
}

export function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return npm.getSatisfyingVersion(versions, normalizeValue(range));
}

export function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return npm.minSatisfyingVersion(versions, normalizeValue(range));
}

export const api: VersioningApi = {
  ...npm,
  isStable,
  getNewValue,
  isValid,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
  allowUnstableMajorUpgrades: true,
};

export default api;
