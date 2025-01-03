import { DateTime } from 'luxon';
import {
  getNewValue,
  getSatisfyingVersion,
  isStable as isNodeStable,
  isValid,
  matches,
  minSatisfyingVersion,
} from '../node';
import { findScheduleForCodename } from '../node/schedule';
import npm from '../npm';
import type { VersioningApi } from '../types';
import { findLambdaScheduleForVersion } from './schedule';

export const id = 'lambda-node';
export const displayName = 'Lambda Node.js Runtime';
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

export function isStable(version: string): boolean {
  if (!isNodeStable(version)) {
    return false;
  }

  const schedule = findLambdaScheduleForVersion(normalizeValue(version));

  if (!schedule) {
    return false;
  }

  if (typeof schedule.support === 'string') {
    return DateTime.local() < DateTime.fromISO(schedule.support);
  }

  return true;
}

export const api: VersioningApi = {
  ...npm,
  isStable,
  getNewValue,
  isValid,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
  allowUnstableMajorUpgrades: false,
};

export default api;
