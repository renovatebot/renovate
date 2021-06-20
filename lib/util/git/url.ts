import GitUrlParse from 'git-url-parse';
import { logger } from '../../logger';
import * as hostRules from '../host-rules';

export function getHttpUrl(url: string, token?: string): string {
  const parsedUrl = GitUrlParse(url);
  parsedUrl.token = token;
  return parsedUrl.toString('https');
}

export function getBasicAuthHttpUrl(
  url: string,
  username: string,
  password: string
): string {
  const parsedUrl = GitUrlParse(url);

  const encodedUsername = encodeURIComponent(username);
  const encodedPassword = encodeURIComponent(password);
  parsedUrl.user = `${encodedUsername}:${encodedPassword}`;

  const type = /^https?$/.exec(parsedUrl.protocol)
    ? parsedUrl.protocol
    : 'https';

  return parsedUrl.toString(type);
}

export function getRemoteUrlWithToken(url: string, hostType?: string): string {
  const hostRule = hostRules.find({ url, hostType });

  if (hostRule?.token) {
    logger.debug(`Found hostRules token for url ${url}`);
    return getHttpUrl(url, hostRule.token);
  }

  if (hostRule?.username && hostRule?.password) {
    logger.debug(`Found hostRules username and password for url ${url}`);
    return getBasicAuthHttpUrl(url, hostRule.username, hostRule.password);
  }

  return url;
}
