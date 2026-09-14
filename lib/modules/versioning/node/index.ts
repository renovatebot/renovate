import { DateTime } from 'luxon';
import { valid } from 'semver';
import npm, { isVersion } from '../npm/index.ts';
import type { NewValueConfig, VersioningApi } from '../types.ts';
import { findScheduleForCodename, findScheduleForVersion } from './schedule.ts';

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
  if (!npm.isStable(version)) {
    return false;
  }

  const schedule = findScheduleForVersion(version);
  if (!schedule) {
    return false;
  }

  // Node 27+ reworked the release schedule: the dedicated LTS date was dropped
  // (every line now eventually becomes LTS), so the LTS-promotion point is read
  // from a different milestone for those newer entries.
  let ltsStart = schedule.lts;
  if (schedule.alpha) {
    ltsStart = schedule.maintenance;
  }
  if (!ltsStart) {
    return false;
  }

  // We only track when a major line as a whole reached LTS, not which specific
  // release started it — so every release of that major counts as stable once
  // that date passes, even an early one like 18.0.0 that shipped before Node
  // 18's first LTS release (18.12.0). This coarse granularity is intentional.
  return DateTime.local() > DateTime.fromISO(ltsStart);
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
