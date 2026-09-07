import { logger } from '../../../logger/index.ts';
import { find } from '../../../util/host-rules.ts';
import { parseUrl } from '../../../util/url.ts';
import { getGoogleAuthHostRule, isGoogleArtifactRegistry } from '../util.ts';
import { pypiDatasourceId } from './common.ts';
import type { PypiIndexCredentials } from './types.ts';

/**
 * Resolves the credentials for a Python package index URL.
 *
 * The URL's own `user:password@` part - which is often a placeholder such as
 * `${USER}:${PASS}@` - is stripped before matching, so that a `matchHost`
 * containing a path still matches. Google Artifact Registry is only asked for a
 * token when no host rule supplies credentials, so an explicitly configured
 * username/password always wins.
 */
export async function findPypiIndexCredentials(
  indexUrl: string | undefined,
): Promise<PypiIndexCredentials> {
  const parsedUrl = parseUrl(indexUrl);
  if (!parsedUrl) {
    logger.once.debug(`Failed to parse index URL ${indexUrl}`);
    return {};
  }

  parsedUrl.username = '';
  parsedUrl.password = '';
  const { username, password } = find({
    hostType: pypiDatasourceId,
    url: parsedUrl.toString(),
  });
  if (username ?? password) {
    return { username, password };
  }

  if (isGoogleArtifactRegistry(parsedUrl.hostname)) {
    const googleHostRule = await getGoogleAuthHostRule();
    if (googleHostRule) {
      return {
        username: googleHostRule.username,
        password: googleHostRule.password,
      };
    }
    logger.once.debug(
      `Could not get Google access token (url=${parsedUrl.toString()})`,
    );
  }

  return {};
}
