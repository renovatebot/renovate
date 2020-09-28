import is from '@sindresorhus/is';
import equal from 'fast-deep-equal';
import { getPkgReleases } from '../../datasource';
import * as datasourceGithubTags from '../../datasource/github-tags';
import { logger } from '../../logger';
import { resolveFile } from '../../util';
import { isVersion, maxSatisfyingVersion } from '../../versioning/semver';
import { LookupUpdate, PackageUpdateConfig } from '../common';

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

async function generatePolicies(): Promise<NodeJsData> {
  const file = await resolveFile('data/node-js-schedule.json');
  const nodeJsSchedule = (await import(file)) as NodeJsData;
  policies = {
    all: [],
    lts: [],
    active: [],
    lts_active: [],
    lts_latest: [],
    current: [],
  };

  const now = new Date();

  for (const [vRelease, data] of Object.entries(nodeJsSchedule)) {
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

  return nodeJsSchedule;
}

async function checkPolicies(): Promise<void> {
  if (policies && refreshDate > new Date()) {
    return;
  }
  const nodeJsSchedule = await generatePolicies();
  refreshDate = new Date('3000-01-01'); // y3k
  const now = new Date();
  for (const data of Object.values(nodeJsSchedule)) {
    const fields = ['start', 'lts', 'maintenance', 'end'];
    for (const field of fields) {
      const fieldDate = new Date(data[field]);
      if (fieldDate > now && fieldDate < refreshDate) {
        refreshDate = fieldDate;
      }
    }
  }
  logger.debug(`Node.js policies refresh date: ${refreshDate.toString()}`);
}

export async function getPackageUpdates(
  config: PackageUpdateConfig
): Promise<LookupUpdate[]> {
  logger.trace('travis.getPackageUpdates()');
  const { supportPolicy } = config;
  if (!supportPolicy?.length) {
    return [];
  }
  await checkPolicies();
  for (const policy of supportPolicy) {
    if (!Object.keys(policies).includes(policy)) {
      logger.warn({ policy }, `Unknown supportPolicy`);
      return [];
    }
  }
  logger.debug({ supportPolicy }, `supportPolicy`);
  let newValue: any[] = (supportPolicy as (keyof NodeJsPolicies)[])
    .map((policy) => policies[policy])
    .reduce((result, policy) => result.concat(policy), [])
    .sort((a, b) => a - b);
  const newMajor: number = newValue[newValue.length - 1];
  if (config.rangeStrategy === 'pin' || isVersion(config.currentValue[0])) {
    const versions = (
      await getPkgReleases({
        ...config,
        datasource: datasourceGithubTags.id,
        depName: 'nodejs/node',
      })
    ).releases.map((release) => release.version);
    newValue = newValue
      .map(String)
      .map((value) => maxSatisfyingVersion(versions, value));
  }
  if (is.string(config.currentValue[0])) {
    newValue = newValue.map(String);
  }
  newValue.sort((a, b) => a - b);

  // TODO: `config.currentValue` is a string!
  (config.currentValue as any).sort((a, b) => a - b);
  if (equal(config.currentValue, newValue)) {
    return [];
  }
  return [
    {
      newValue: newValue.join(','),
      newMajor,
      isRange: true,
      sourceUrl: 'https://github.com/nodejs/node',
    },
  ];
}
