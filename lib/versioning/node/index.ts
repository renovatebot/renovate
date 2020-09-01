import moment from 'moment';
import nodeData from '../../../data/node-js-schedule.json';
import { NewValueConfig, VersioningApi } from '../common';
import npm, { isValid, isVersion } from '../npm';
import { NodeJsData } from './common';

export const id = 'node';
export const displayName = 'Node.js';
export const urls = [];
export const supportsRanges = false;

function getNewValue({
  currentValue,
  rangeStrategy,
  fromVersion,
  toVersion,
}: NewValueConfig): string {
  const res = npm.getNewValue({
    currentValue,
    rangeStrategy,
    fromVersion,
    toVersion,
  });
  if (isVersion(res)) {
    // normalize out any 'v' prefix
    return isVersion(res);
  }
  return res;
}

export { isValid };

export function isStable(version: string, now = Date.now()): boolean {
  if (npm.isStable(version)) {
    const major = npm.getMajor(version);
    const data = nodeData as NodeJsData;
    const schedule = data[`v${major}`];
    if (schedule) {
      const { lts, end } = schedule;
      const ltsStart = moment(lts);
      const ltsFinish = moment(end);
      return moment(now).isBetween(ltsStart, ltsFinish);
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
