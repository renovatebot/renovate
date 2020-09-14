import is from '@sindresorhus/is';
import equal from 'fast-deep-equal';
import { getPkgReleases } from '../../datasource';
import * as datasourceGithubTags from '../../datasource/github-tags';
import { logger } from '../../logger';
import {
  NodeJsPolicies,
  nodePolicies,
  nodeSchedule,
} from '../../versioning/node/node-js-schedule';
import { isVersion, maxSatisfyingVersion } from '../../versioning/semver';
import { LookupUpdate, PackageUpdateConfig } from '../common';

let refreshDate: Date;

function checkPolicies(): void {
  if (nodePolicies && refreshDate > new Date()) {
    return;
  }
  const nodeJsSchedule = nodeSchedule;
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
  checkPolicies();
  for (const policy of supportPolicy) {
    if (!Object.keys(nodePolicies).includes(policy)) {
      logger.warn({ policy }, `Unknown supportPolicy`);
      return [];
    }
  }
  logger.debug({ supportPolicy }, `supportPolicy`);
  let newValue: any[] = (supportPolicy as (keyof NodeJsPolicies)[])
    .map((policy) => nodePolicies[policy])
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
