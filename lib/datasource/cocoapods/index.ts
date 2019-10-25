import crypto from 'crypto';
import { api } from '../../platform/github/gh-got-wrapper';
import { PkgReleaseConfig, ReleaseResult } from '../common';
import { logger } from '../../logger';

const cacheNamespace = 'cocoapods';
const cacheMinutes = 30;

function shardPart(lookupName) {
  return crypto
    .createHash('md5')
    .update(lookupName)
    .digest('hex')
    .slice(0, 3)
    .split('')
    .join('/');
}

function releasesUrl(lookupName, opts) {
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

async function getReleases(
  lookupName,
  registryUrl,
  useShard
): Promise<ReleaseResult | null> {
  const match = registryUrl
    .replace(/\.git$/, '')
    .replace(/\/+$/, '')
    .match(/https:\/\/github\.com\/(?<account>[^/]+)\/(?<repo>[^/]+)$/);
  const groups = (match && match.groups) || {};
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

export async function getPkgReleases(
  config: Partial<PkgReleaseConfig>
): Promise<ReleaseResult | null> {
  const { registryUrls, lookupName } = config;

  if (!lookupName) {
    logger.debug(config, `CocoaPods: invalid lookup name`);
    return null;
  }

  if (!registryUrls.length) {
    logger.debug(config, `CocoaPods: invalid registryUrls`);
    return null;
  }

  logger.debug(
    `CocoaPods: Found ${registryUrls.length} repositories for ${lookupName}`
  );

  const podName = lookupName.replace(/\/.*$/, '');

  const cachedResult = await renovateCache.get<ReleaseResult>(
    cacheNamespace,
    podName
  );
  /* istanbul ignore next line */
  if (cachedResult) {
    logger.debug(`CocoaPods: Return cached result for ${podName}`);
    return cachedResult;
  }

  for (let idx = 0; idx < registryUrls.length; idx += 1) {
    const registryUrl = registryUrls[idx];
    const useShard = idx === 0; // First element is default CocoaPods repo (with sharding)
    const result = await getReleases(podName, registryUrl, useShard);
    if (result) {
      await renovateCache.set(cacheNamespace, podName, result, cacheMinutes);
      return result;
    }
  }
  return null;
}
