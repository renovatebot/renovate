import crypto from 'crypto';
import { api } from '../../platform/github/gh-got-wrapper';
import { ReleaseResult, PkgReleaseConfig } from '../common';
import { logger } from '../../logger';

function shardPart(lookupName) {
  return crypto
    .createHash('md5')
    .update(lookupName)
    .digest('hex')
    .slice(0, 3)
    .split('')
    .join('/');
}

function releasesUrl(lookupName, opts = {}) {
  const defaults = {
    useShard: true,
    account: 'CocoaPods',
    repo: 'Specs',
  };

  const { useShard, account, repo } = Object.assign(defaults, opts);
  const prefix = 'https://api.github.com/repos';
  const suffix = useShard
    ? `${shardPart(lookupName)}/${lookupName}`
    : lookupName;
  return `${prefix}/${account}/${repo}/contents/Specs/${suffix}`;
}

async function getReleases(lookupName, registryUrl, useShard = false) {
  const match = registryUrl.match(
    /https:\/\/github\.com\/(?<account>[^/])\/(?<repo>[^/])/
  );
  const groups = match ? match.groups : {};
  const opts = { ...groups, useShard };
  const url = releasesUrl(lookupName, opts);
  try {
    const resp = await api.get(url);
    if (resp && resp.body) {
      const releases = resp.body.map(({ name }) => ({ version: name }));
      return { releases };
    }
  } catch (err) {
    const errorData = { lookupName, err };

    if (
      err.statusCode === 429 ||
      (err.statusCode >= 500 && err.statusCode < 600)
    ) {
      logger.warn({ lookupName, err }, `CocoaPods registry failure`);
      throw new Error('registry-failure');
    }

    if (err.statusCode === 401) {
      logger.debug(errorData, 'Authorization error');
    } else if (err.statusCode === 404) {
      if (!useShard) {
        return getReleases(lookupName, registryUrl, true);
      }

      logger.debug(errorData, 'Package lookup error');
    } else {
      logger.warn(errorData, 'CocoaPods lookup failure: Unknown error');
    }
  }

  return null;
}

export async function getPkgReleases({
  registryUrls,
  lookupName,
}: Partial<PkgReleaseConfig>): Promise<ReleaseResult | null> {
  logger.debug(
    `CocoaPods: Found ${registryUrls.length} repositories for ${lookupName}`
  );

  for (let idx = 0; idx < registryUrls.length; idx += 1) {
    const registryUrl = registryUrls[idx];
    const useShard = idx === 0;
    const releases = await getReleases(lookupName, registryUrl, useShard);
    if (releases) return releases;
  }
  return null;
}
