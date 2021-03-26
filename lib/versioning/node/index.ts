import { DateTime } from 'luxon';
import npm, { isValid, isVersion } from '../npm';
import type { NewValueConfig, VersioningApi } from '../types';
import { nodeSchedule } from './schedule';

export const id = 'node';
export const displayName = 'Node.js';
export const urls = [];
export const supportsRanges = false;

function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  newVersion,
}: NewValueConfig): string {
  const res = npm.getNewValue({
    currentValue,
    rangeStrategy,
    currentVersion,
    newVersion,
  });
  if (isVersion(res)) {
    // normalize out any 'v' prefix
    return isVersion(res);
  }
  return res;
}

export { isValid };

export function isStable(version: string): boolean {
  if (npm.isStable(version)) {
    const major = npm.getMajor(version);
    const schedule = nodeSchedule[`v${major}`];
    if (schedule?.lts) {
      // TODO: use the exact release that started LTS
      return DateTime.local() > DateTime.fromISO(schedule.lts);
    }
  }
  return false;
}

export const api: VersioningApi = {
  ...npm,
  isStable,
  getNewValue,
};
export default api;
