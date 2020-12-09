import is from '@sindresorhus/is';
import equal from 'fast-deep-equal';
import { getPkgReleases } from '../../datasource';
import * as datasourceGithubTags from '../../datasource/github-tags';
import { logger } from '../../logger';
import { NodeJsPolicies, getPolicies } from '../../versioning/node/schedule';
import { isVersion, maxSatisfyingVersion } from '../../versioning/semver';
import { LookupUpdate, PackageUpdateConfig } from '../common';

export async function getPackageUpdates(
  config: PackageUpdateConfig
): Promise<LookupUpdate[]> {
  logger.trace('travis.getPackageUpdates()');
  const { supportPolicy } = config;
  if (!supportPolicy?.length) {
    return [];
  }
  const policies = getPolicies();
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
