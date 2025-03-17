import { DateTime } from 'luxon';
import {
  getNewValue,
  getSatisfyingVersion,
  isValid,
  matches,
  minSatisfyingVersion,
} from '../node';
import npm from '../npm';
import type { VersioningApi } from '../types';
import { findLambdaScheduleForVersion } from './schedule';

export const id = 'lambda-node';
export const displayName = 'Lambda Node.js Runtime';
export const urls = [];
export const supportsRanges = false;

export function isStable(version: string): boolean {
  const schedule = findLambdaScheduleForVersion(version);

  if (schedule === null) {
    return false;
  }

  if (typeof schedule.support === 'string') {
    return DateTime.now() < DateTime.fromISO(schedule.support);
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
