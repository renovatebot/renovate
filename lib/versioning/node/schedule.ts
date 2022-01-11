import dataFiles from '../../data-files.generated';
import semver from '../semver';

interface NodeJsSchedule {
  lts?: string;
  maintenance?: string;
  end: string;
  start: string;
  codename?: string;
}

export type NodeJsData = Record<string, NodeJsSchedule>;

export const nodeSchedule: NodeJsData = JSON.parse(
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  dataFiles.get('data/node-js-schedule.json')!
);

export type NodeJsScheduleWithVersion = { version: string } & NodeJsSchedule;

export function findScheduleForCodename(
  codename: string
): NodeJsScheduleWithVersion | null {
  for (const version of Object.keys(nodeSchedule)) {
    const schedule = nodeSchedule[version];
    if (
      schedule.codename &&
      schedule.codename.toUpperCase() === codename?.toUpperCase()
    ) {
      return { version: version, ...schedule };
    }
  }
  return null;
}

export function findScheduleForVersion(version: string): NodeJsSchedule | null {
  const major = semver.getMajor(version);
  const schedule = nodeSchedule[`v${major}`];
  return schedule;
}
