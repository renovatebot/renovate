import dataFiles from '../../data-files.generated';
import npm from '../npm';

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

export function findScheduleForCodename(
  codename: string
): ({ version: string } & NodeJsSchedule) | null {
  for (const version of Object.keys(nodeSchedule)) {
    const schedule = nodeSchedule[version];
    if (
      schedule.codename &&
      schedule.codename.toLowerCase() === codename?.toLowerCase()
    ) {
      return { version: version, ...schedule };
    }
  }
  return null;
}

export function findScheduleForVersion(version: string): NodeJsSchedule | null {
  const major = npm.getMajor(version);
  const schedule = nodeSchedule[`v${major}`];
  return schedule;
}
