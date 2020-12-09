import dataFiles from '../../data-files.generated';

interface NodeJsSchedule {
  lts?: string;
  maintenance?: string;
  end: string;
  start: string;
  codename?: string;
}

export type NodeJsData = Record<string, NodeJsSchedule>;

export const nodeSchedule: NodeJsData = JSON.parse(
  dataFiles.get('node-js-schedule.json')
);

export interface NodeJsPolicies {
  all: number[];
  lts: number[];
  active: number[];
  lts_active: number[];
  lts_latest: number[];
  current: number[];
}

export function getPolicies(): NodeJsPolicies {
  const policies = {
    all: [],
    lts: [],
    active: [],
    lts_active: [],
    lts_latest: [],
    current: [],
  };

  const now = new Date();

  for (const [vRelease, data] of Object.entries(nodeSchedule)) {
    const isAlive = new Date(data.start) < now && new Date(data.end) > now;
    if (isAlive) {
      const release = parseInt(vRelease.replace(/^v/, ''), 10);
      policies.all.push(release);
      const isMaintenance =
        data.maintenance && new Date(data.maintenance) < now;
      if (!isMaintenance) {
        policies.active.push(release);
      }
      const isLts = data.lts && new Date(data.lts) < now;
      if (isLts) {
        policies.lts.push(release);
        if (!isMaintenance) {
          policies.lts_active.push(release);
        }
      }
    }
  }
  policies.current.push(policies.active[policies.active.length - 1]);
  policies.lts_latest.push(policies.lts[policies.lts.length - 1]);

  return policies;
}
