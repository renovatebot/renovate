import GitUrlParse from 'git-url-parse';
import { logger } from '../../logger';
import * as hostRules from '../host-rules';

export function getHttpUrl(url: string, token?: string): string {
  const parsedUrl = GitUrlParse(url);
  parsedUrl.token = token;
  return parsedUrl.toString('https');
}

export function getRemoteUrlWithToken(url: string): string {
  let remote = url;

  const hostRule = hostRules.find({ url });
  if (hostRule?.token) {
    logger.debug(`Found hostRules token for url ${url}`);
    remote = getHttpUrl(url, hostRule.token);
  }

  return remote;
}
