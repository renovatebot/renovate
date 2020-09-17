interface NodeJsSchedule {
  lts?: string;
  maintenance?: string;
  end: string;
  start: string;
  codename?: string;
}

export type NodeJsData = Record<string, NodeJsSchedule>;

// The following is kept in sync manually from https://github.com/nodejs/Release/blob/master/schedule.json
export const nodeSchedule: NodeJsData = {
  'v0.10': {
    start: '2013-03-11',
    end: '2016-10-31',
  },
  'v0.12': {
    start: '2015-02-06',
    end: '2016-12-31',
  },
  v4: {
    start: '2015-09-08',
    lts: '2015-10-12',
    maintenance: '2017-04-01',
    end: '2018-04-30',
    codename: 'Argon',
  },
  v5: {
    start: '2015-10-29',
    maintenance: '2016-04-30',
    end: '2016-06-30',
  },
  v6: {
    start: '2016-04-26',
    lts: '2016-10-18',
    maintenance: '2018-04-30',
    end: '2019-04-30',
    codename: 'Boron',
  },
  v7: {
    start: '2016-10-25',
    maintenance: '2017-04-30',
    end: '2017-06-30',
  },
  v8: {
    start: '2017-05-30',
    lts: '2017-10-31',
    maintenance: '2019-01-01',
    end: '2019-12-31',
    codename: 'Carbon',
  },
  v9: {
    start: '2017-10-01',
    maintenance: '2018-04-01',
    end: '2018-06-30',
  },
  v10: {
    start: '2018-04-24',
    lts: '2018-10-30',
    maintenance: '2020-05-19',
    end: '2021-04-30',
    codename: 'Dubnium',
  },
  v11: {
    start: '2018-10-23',
    maintenance: '2019-04-22',
    end: '2019-06-01',
  },
  v12: {
    start: '2019-04-23',
    lts: '2019-10-21',
    maintenance: '2020-10-20',
    end: '2022-04-30',
    codename: 'Erbium',
  },
  v13: {
    start: '2019-10-22',
    maintenance: '2020-04-01',
    end: '2020-06-01',
  },
  v14: {
    start: '2020-04-21',
    lts: '2020-10-27',
    maintenance: '2021-10-19',
    end: '2023-04-30',
    codename: '',
  },
  v15: {
    start: '2020-10-20',
    maintenance: '2021-04-01',
    end: '2021-06-01',
  },
  v16: {
    start: '2021-04-20',
    lts: '2021-10-26',
    maintenance: '2022-10-18',
    end: '2024-04-30',
    codename: '',
  },
};

export interface NodeJsPolicies {
  all: number[];
  lts: number[];
  active: number[];
  lts_active: number[];
  lts_latest: number[];
  current: number[];
}

function generatePolicies(): NodeJsPolicies {
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

export const nodePolicies = generatePolicies();
