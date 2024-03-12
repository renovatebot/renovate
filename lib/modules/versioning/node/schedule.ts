import dataFiles from '../../../data-files.generated';
import semver from '../semver';

interface NodeJsSchedule {
  lts?: string;
  maintenance?: string;
  end: string;
  start: string;
  codename?: string;
}

export type NodeJsData = Record<string, NodeJsSchedule>;

const nodeSchedule: NodeJsData = JSON.parse(
  dataFiles.get('data/node-js-schedule.json')!,
);

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
): NodeJsScheduleWithVersion | null {
  return nodeCodenames.get(codename?.toUpperCase()) ?? null;
}

export function findScheduleForVersion(version: string): NodeJsSchedule | null {
  const major = semver.getMajor(version);
  // TODO: types (#22198)
  const schedule = nodeSchedule[`v${major!}`];
  return schedule;
}
