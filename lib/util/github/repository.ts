import { z } from 'zod/v4';
import { logger } from '../../logger/index.ts';
import { withCache } from '../cache/package/with-cache.ts';
import * as hostRules from '../host-rules.ts';
import { GithubHttp } from '../http/github.ts';
import { getApiBaseUrl, parseSourceUrl } from './url.ts';

const http = new GithubHttp();

const GithubRepository = z.object({
  archived: z.boolean(),
  private: z.boolean(),
});

/**
 * Whether the public GitHub repository at `sourceUrl` is archived, or `null`
 * if that can't be told: the URL isn't a repository on github.com or the
 * GitHub platform endpoint, there's no token for it, the repository is
 * private, or the request failed.
 */
export async function isRepositoryArchived(
  sourceUrl: string,
): Promise<boolean | null> {
  const source = parseSourceUrl(sourceUrl);
  if (!source) {
    return null;
  }
  // The source URL comes from package metadata, so only the GitHub hosts
  // Renovate trusts with GitHub tokens get a request.
  const url = `${getApiBaseUrl(source.registryUrl)}repos/${source.packageName}`;
  if (!hostRules.usesGithubUrlFallback(url)) {
    return null;
  }

  const { token } = hostRules.find({ hostType: 'github', url, readOnly: true });
  if (!token) {
    logger.once.debug('No GitHub token, skipping archived repository checks');
    return null;
  }

  try {
    return await withCache(
      {
        namespace: 'github-repository-archived',
        key: url,
        ttlMinutes: 24 * 60,
      },
      async (ctx) => {
        const { body } = await http.getJson(url, GithubRepository);
        // The source URL comes from package metadata and the token may reach
        // private repositories it names, so only a public repository's state
        // is reported, and only that is cached.
        ctx.public = !body.private;
        ctx.cacheable = !body.private;
        return body.private ? null : body.archived;
      },
    );
  } catch (err) {
    logger.debug(
      { sourceUrl, err },
      'Could not check whether the repository is archived',
    );
    return null;
  }
}
