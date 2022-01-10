import { DateTime } from 'luxon';
import { valid } from 'semver';
import npm, { isValid, isVersion } from '../npm';
import type { NewValueConfig, VersioningApi } from '../types';
import {
  findScheduleForCodename,
  findScheduleForVersion,
  nodeSchedule,
} from './schedule';

export const id = 'node';
export const displayName = 'Node.js';
export const urls = [];
export const supportsRanges = false;

function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  newVersion,
}: NewValueConfig): string | null {
  // Try to use codename if the current value is a codename
  if (findScheduleForCodename(currentValue)) {
    const newSchedule = findScheduleForVersion(newVersion);
    if (newSchedule?.codename) {
      return newSchedule.codename.toLowerCase();
    }
  }
  const res = npm.getNewValue({
    currentValue,
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

export function valueToVersion(value: string): string {
  const schedule = findScheduleForCodename(value);
  return schedule?.version || value;
}

export { isValid };

export function isStable(version: string): boolean {
  if (npm.isStable(version)) {
    const major = npm.getMajor(version);
    const schedule = nodeSchedule[`v${major}`];
    if (schedule?.lts) {
      // TODO: use the exact release that started LTS (#9716)
      return DateTime.local() > DateTime.fromISO(schedule.lts);
    }
  }
  return false;
}

export const api: VersioningApi = {
  ...npm,
  isStable,
  getNewValue,
  valueToVersion,
};

export default api;
