import is from '@sindresorhus/is';
import { isEqual } from 'lodash';
import { logger } from '../../logger';
import { getPkgReleases } from '../../datasource';
import { isVersion, maxSatisfyingVersion } from '../../versioning/semver';
import nodeJsSchedule from '../../../data/node-js-schedule.json';
import { PackageUpdateConfig, PackageUpdateResult } from '../common';

interface NodeJsPolicies {
  all: number[];
  lts: number[];
  active: number[];
  lts_active: number[];
  lts_latest: number[];
  current: number[];
}
interface NodeJsSchedule {
  lts: string;
  maintenance: string;
  end: string;
  start: string;
}
type NodeJsData = Record<string, NodeJsSchedule>;

let policies: NodeJsPolicies;
let refreshDate: Date;

function generatePolicies(): void {
  policies = {
    all: [],
    lts: [],
    active: [],
    lts_active: [],
    lts_latest: [],
    current: [],
  };

  const now = new Date();

  for (const [vRelease, data] of Object.entries(nodeJsSchedule as NodeJsData)) {
    const isAlive = new Date(data.start) < now && new Date(data.end) > now;
    if (isAlive) {
      const release = parseInt(vRelease.replace(/^v/, ''), 10);
      policies.all.push(release);
      const isMaintenance =
        data.maintenance && new Date(data.maintenance) < now;
      if (!isMaintenance) policies.active.push(release);
      const isLts = data.lts && new Date(data.lts) < now;
      if (isLts) {
        policies.lts.push(release);
        if (!isMaintenance) policies.lts_active.push(release);
      }
    }
  }
  policies.current.push(policies.active[policies.active.length - 1]);
  policies.lts_latest.push(policies.lts[policies.lts.length - 1]);
}

function checkPolicies(): void {
  if (policies && refreshDate > new Date()) {
    return;
  }
  generatePolicies();
  refreshDate = new Date('3000-01-01'); // y3k
  const now = new Date();
  for (const data of Object.values(nodeJsSchedule as NodeJsData)) {
    const fields = ['start', 'lts', 'maintenance', 'end'];
    for (const field of fields) {
      const fieldDate = new Date(data[field]);
      if (fieldDate > now && fieldDate < refreshDate) {
        refreshDate = fieldDate;
      }
    }
  }
  logger.debug('Node.js policies refresh date: ' + refreshDate);
}

export async function getPackageUpdates(
  config: PackageUpdateConfig
): Promise<PackageUpdateResult[]> {
  logger.trace('travis.getPackageUpdates()');
  const { supportPolicy } = config;
  if (!(supportPolicy && supportPolicy.length)) {
    return [];
  }
  checkPolicies();
  for (const policy of supportPolicy) {
    if (!Object.keys(policies).includes(policy)) {
      logger.warn(`Unknown supportPolicy: ${policy}`);
      return [];
    }
  }
  logger.debug({ supportPolicy }, `supportPolicy`);
  // TODO: `newValue` is a (string | number)[] !
  let newValue: any[] = (supportPolicy as (keyof NodeJsPolicies)[])
    .map(policy => policies[policy])
    .reduce((result, policy) => result.concat(policy), [])
    .sort((a, b) => a - b);
  const newMajor = newValue[newValue.length - 1];
  if (config.rangeStrategy === 'pin' || isVersion(config.currentValue[0])) {
    const versions = (await getPkgReleases({
      ...config,
      datasource: 'github',
      depName: 'nodejs/node',
    })).releases.map(release => release.version);
    newValue = newValue.map(value =>
      maxSatisfyingVersion(versions, `${value}`)
    );
  }
  if (is.string(config.currentValue[0])) {
    newValue = newValue.map(val => `${val}`);
  }
  newValue.sort((a, b) => a - b);

  // TODO: `config.currentValue` is a string!
  (config.currentValue as any).sort((a, b) => a - b);
  if (isEqual(config.currentValue, newValue)) {
    return [];
  }
  return [
    {
      newValue,
      newMajor,
      isRange: true,
      sourceUrl: 'https://github.com/nodejs/node',
    },
  ];
}
