import GitUrlParse from 'git-url-parse';
import { logger } from '../../logger';
import * as hostRules from '../host-rules';
import { regEx } from '../regex';

export function getHttpUrl(url: string, token?: string): string {
  const parsedUrl = GitUrlParse(url);

  parsedUrl.token = token;

  const protocol = regEx(/^https?$/).exec(parsedUrl.protocol)
    ? parsedUrl.protocol
    : 'https';
  return parsedUrl.toString(protocol);
}

export function getRemoteUrlWithToken(url: string, hostType?: string): string {
  const hostRule = hostRules.find({ url, hostType });

  if (hostRule?.token) {
    logger.debug(`Found hostRules token for url ${url}`);

    return getHttpUrl(url, encodeURIComponent(hostRule.token));
  }

  if (hostRule?.username && hostRule?.password) {
    logger.debug(`Found hostRules username and password for url ${url}`);
    const encodedUsername = encodeURIComponent(hostRule.username);
    const encodedPassword = encodeURIComponent(hostRule.password);

    return getHttpUrl(url, `${encodedUsername}:${encodedPassword}`);
  }

  return url;
}
