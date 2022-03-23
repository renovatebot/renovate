import { logger } from '../../../logger';
import * as githubHttp from '../../../util/http/github';
import type { UserDetails } from './types';

const githubApi = new githubHttp.GithubHttp();

export async function getUserDetails(
  endpoint: string,
  token: string
): Promise<UserDetails> {
  try {
    const userData = (
      await githubApi.getJson<{ login: string; name: string }>(
        endpoint + 'user',
        {
          token,
        }
      )
    ).body;
    return {
      username: userData.login,
      name: userData.name,
    };
  } catch (err) {
    logger.debug({ err }, 'Error authenticating with GitHub');
    throw new Error('Init: Authentication failure');
  }
}

export async function getUserEmail(
  endpoint: string,
  token: string
): Promise<string | null> {
  try {
    const emails = (
      await githubApi.getJson<{ email: string }[]>(endpoint + 'user/emails', {
        token,
      })
    ).body;
    return emails?.[0].email ?? null;
  } catch (err) {
    logger.debug(
      'Cannot read user/emails endpoint on GitHub to retrieve gitAuthor'
    );
    return null;
  }
}
