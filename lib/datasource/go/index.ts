import * as github from '../github-tags';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';
import * as goproxy from './goproxy';
import { bitbucket, getDatasource } from './util';
import * as vcs from './vcs';

export { id } from './common';

export const customRegistrySupport = false;

/**
 * go.getReleases
 *
 * This datasource resolves a go module URL into its source repository
 *  and then fetch it if it is on GitHub.
 *
 * This function will:
 *  - Determine the source URL for the module
 *  - Call the respective getReleases in github/gitlab to retrieve the tags
 *  - Filter module tags according to the module path
 */
export function getReleases(
  config: GetReleasesConfig
): Promise<ReleaseResult | null> {
  return process.env.GOPROXY
    ? goproxy.getReleases(config)
    : vcs.getReleases(config);
}

/**
 * go.getDigest
 *
 * This datasource resolves a go module URL into its source repository
 *  and then fetches the digest it if it is on GitHub.
 *
 * This function will:
 *  - Determine the source URL for the module
 *  - Call the respective getDigest in github to retrieve the commit hash
 */
export async function getDigest(
  { lookupName }: Partial<DigestConfig>,
  value?: string
): Promise<string | null> {
  const source = await getDatasource(lookupName);
  if (!source) {
    return null;
  }

  // ignore v0.0.0- pseudo versions that are used Go Modules - look up default branch instead
  const tag = value && !value.startsWith('v0.0.0-2') ? value : undefined;

  switch (source.datasource) {
    case github.id: {
      return github.getDigest(source, tag);
    }
    case bitbucket.id: {
      return bitbucket.getDigest(source, tag);
    }
    /* istanbul ignore next: can never happen, makes lint happy */
    default: {
      return null;
    }
  }
}
