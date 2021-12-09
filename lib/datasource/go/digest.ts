import * as github from '../github-tags';
import type { DigestConfig } from '../types';
import { bitbucket } from './common';
import { getDatasource } from './get-datasource';

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
