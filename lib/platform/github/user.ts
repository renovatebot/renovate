import { logger } from '../../logger';
import * as githubHttp from '../../util/http/github';

const githubApi = new githubHttp.GithubHttp();

export interface UserDetails {
  username: string;
  name: string;
}

let userDetails: UserDetails;

export async function getUserDetails(
  endpoint: string,
  token: string
): Promise<UserDetails> {
  if (userDetails) {
    return userDetails;
  }
  try {
    const userData = (
      await githubApi.getJson<{ login: string; name: string }>(
        endpoint + 'user',
        {
          token,
        }
      )
    ).body;
    userDetails = {
      username: userData.login,
      name: userData.name,
    };
    return userDetails;
  } catch (err) {
    logger.debug({ err }, 'Error authenticating with GitHub');
    throw new Error('Init: Authentication failure');
  }
}

let userEmail: string;

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
    userEmail = emails?.[0].email || null;
    return userEmail;
  } catch (err) {
    logger.debug(
      'Cannot read user/emails endpoint on GitHub to retrieve gitAuthor'
    );
    return null;
  }
}
