import { logger } from '../../../logger';
import * as githubHttp from '../../../util/http/github';
import type { UserDetails } from './types';

const githubApi = new githubHttp.GithubHttp();

export async function getAppDetails(token: string): Promise<UserDetails> {
  try {
    const appData = await githubApi.requestGraphql<{
      viewer: {
        login: string;
        databaseId: number;
      };
    }>('query { viewer { login databaseId }}', { token });
    if (!appData?.data) {
      throw new Error("Init: Can't get App details");
    }
    return {
      username: appData.data.viewer.login,
      name: appData.data.viewer.login,
      id: appData.data.viewer.databaseId,
    };
  } catch (err) {
    logger.debug({ err }, 'Error authenticating with GitHub');
    throw new Error('Init: Authentication failure');
  }
}

export async function getUserDetails(
  endpoint: string,
  token: string,
): Promise<UserDetails> {
  try {
    const userData = (
      await githubApi.getJson<{ login: string; name: string; id: number }>(
        endpoint + 'user',
        {
          token,
        },
      )
    ).body;
    return {
      username: userData.login,
      name: userData.name,
      id: userData.id,
    };
  } catch (err) {
    logger.debug({ err }, 'Error authenticating with GitHub');
    throw new Error('Init: Authentication failure');
  }
}

export async function getUserEmail(
  endpoint: string,
  token: string,
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
      'Cannot read user/emails endpoint on GitHub to retrieve gitAuthor',
    );
    return null;
  }
}
