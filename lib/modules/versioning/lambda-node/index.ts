import { DateTime } from 'luxon';
import { api as nodeApi } from '../node';
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
    return DateTime.local() < DateTime.fromISO(schedule.support);
  }

  return true;
}

export const api: VersioningApi = {
  ...nodeApi,
  isStable,
};

export default api;
