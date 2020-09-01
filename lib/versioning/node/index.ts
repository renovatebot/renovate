import moment from 'moment';
import { resolveFile } from '../../util/resolve-file';
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

let nodeData: NodeJsData = {};

async function initModule(): Promise<void> {
  const file = await resolveFile('data/node-js-schedule.json');
  nodeData = (await import(file)) as NodeJsData;
}

export function isStable(version: string, now = Date.now()): boolean {
  if (npm.isStable(version)) {
    const major = npm.getMajor(version);
    const schedule = nodeData[`v${major}`];
    if (schedule) {
      const { maintenance, end } = schedule;
      const ltsStart = moment(maintenance);
      const ltsFinish = moment(end);
      return moment(now).isBetween(ltsStart, ltsFinish);
    }
  }
  return false;
}

export const api: VersioningApi = {
  ...npm,
  initModule,
  isStable,
  getNewValue,
};
export default api;
