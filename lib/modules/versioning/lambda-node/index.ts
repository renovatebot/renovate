import { isString } from '@sindresorhus/is';
import { DateTime } from 'luxon';
import { api as nodeApi } from '../node/index.ts';
import type { VersioningApi } from '../types.ts';
import { findLambdaScheduleForVersion } from './schedule.ts';

export const id = 'lambda-node';
export const displayName = 'Lambda Node.js Runtime';
export const urls = [];
export const supportsRanges = false;

export function isStable(version: string): boolean {
  const schedule = findLambdaScheduleForVersion(version);

  if (schedule === null) {
    return false;
  }

  if (isString(schedule.support)) {
    return DateTime.local() < DateTime.fromISO(schedule.support);
  }

  return true;
}

export const api: VersioningApi = {
  ...nodeApi,
  isStable,
};

export default api;
