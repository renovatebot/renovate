import { z } from 'zod/v4';
import { logger } from '../../../logger/index.ts';
import { getEnv } from '../../../util/env.ts';
import { Http } from '../../../util/http/index.ts';
import { parseUrl } from '../../../util/url.ts';

const IdTokenResponse = z.object({
  value: z.string().min(1),
});

const http = new Http('forgejo');

/**
 * Fetches a short-lived OIDC ID token from the Forgejo Actions runtime, for
 * authenticating as a Forgejo Authorized Integration.
 *
 * https://forgejo.org/docs/latest/user/authorized-integrations/
 */
export async function getActionsIdToken(audience: string): Promise<string> {
  const env = getEnv();
  const requestUrl = env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const requestToken = env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!requestUrl || !requestToken) {
    throw new Error(
      'Init: forgejoOidcAudience is configured but the ACTIONS_ID_TOKEN_REQUEST_URL and ACTIONS_ID_TOKEN_REQUEST_TOKEN environment variables are missing. These variables are only available in Forgejo Actions workflows which set `enable-openid-connect: true`.',
    );
  }

  const url = parseUrl(requestUrl);
  if (!url) {
    throw new Error('Init: ACTIONS_ID_TOKEN_REQUEST_URL is not a valid URL');
  }
  url.searchParams.set('audience', audience);

  logger.debug('Requesting Forgejo Actions OIDC ID token');
  const { body } = await http.getJson(
    url.toString(),
    { headers: { authorization: `Bearer ${requestToken}` } },
    IdTokenResponse,
  );
  return body.value;
}
