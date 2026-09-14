import _nodeSchedule from '../../../data/node-js-schedule.json' with { type: 'json' };
import type { Nullish } from '../../../types/index.ts';
import semver from '../semver/index.ts';
import type {
  NodeJsData,
  NodeJsSchedule,
  NodeJsScheduleWithVersion,
} from './types.ts';

const nodeSchedule: NodeJsData = _nodeSchedule;

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
