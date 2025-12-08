import _nodeSchedule from '../../../data/node-js-schedule.json';
import type { Nullish } from '../../../types';
import semver from '../semver';

interface NodeJsSchedule {
  lts?: string;
  maintenance?: string;
  end: string;
  start: string;
  codename?: string;
}

export type NodeJsData = Record<string, NodeJsSchedule>;
const nodeSchedule: NodeJsData = _nodeSchedule;
export type NodeJsScheduleWithVersion = { version: string } & NodeJsSchedule;

const nodeCodenames = new Map<string, NodeJsScheduleWithVersion>();
for (const version of Object.keys(nodeSchedule)) {
  const schedule = nodeSchedule[version];
  if (schedule.codename) {
    nodeCodenames.set(schedule.codename.toUpperCase(), {
      version,
      ...schedule,
    });
  }
}

export function findScheduleForCodename(
  codename: string,
): Nullish<NodeJsScheduleWithVersion> {
  return nodeCodenames.get(codename?.toUpperCase());
}

export function findScheduleForVersion(
  version: string,
): Nullish<NodeJsSchedule> {
  const major = semver.getMajor(version);
  const schedule = nodeSchedule[`v${major!}`];
  return schedule;
}
