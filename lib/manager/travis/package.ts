import is from '@sindresorhus/is';
import { dequal } from 'dequal';
import { getPkgReleases } from '../../datasource';
import * as datasourceGithubTags from '../../datasource/github-tags';
import { logger } from '../../logger';
import { NodeJsPolicies, getPolicies } from '../../versioning/node/schedule';
import { getSatisfyingVersion, isVersion } from '../../versioning/semver';
import type { PackageUpdateConfig, PackageUpdateResult } from '../types';

export async function getPackageUpdates(
  config: PackageUpdateConfig
): Promise<PackageUpdateResult> {
  logger.trace('travis.getPackageUpdates()');
  const { supportPolicy } = config;
  if (!supportPolicy?.length) {
    return { updates: [] };
  }
  const policies = getPolicies();
  for (const policy of supportPolicy) {
    if (!Object.keys(policies).includes(policy)) {
      logger.warn({ policy }, `Unknown supportPolicy`);
      return { updates: [] };
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
      .map((value) => getSatisfyingVersion(versions, value));
  }
  if (is.string(config.currentValue[0])) {
    newValue = newValue.map(String);
  }
  newValue.sort((a, b) => a - b);

  // TODO: `config.currentValue` is a string!
  (config.currentValue as any).sort((a, b) => a - b);
  if (dequal(config.currentValue, newValue)) {
    return { updates: [] };
  }
  return {
    sourceUrl: 'https://github.com/nodejs/node',
    updates: [
      {
        newValue: newValue.join(','),
        newMajor,
        isRange: true,
      },
    ],
  };
}
