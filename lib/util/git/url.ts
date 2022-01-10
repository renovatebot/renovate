import GitUrlParse from 'git-url-parse';
import { logger } from '../../logger';
import * as hostRules from '../host-rules';
import { regEx } from '../regex';
import { AuthenticationRule } from './types';

export function getHttpUrl(url: string, token?: string): string {
  const parsedUrl = GitUrlParse(url);

  parsedUrl.token = token;

  const protocol = regEx(/^https?$/).exec(parsedUrl.protocol)
    ? parsedUrl.protocol
    : 'https';
  return parsedUrl.toString(protocol);
}

/**
 * Generates the authentication rules for later git usage for the given host
 * @link https://coolaj86.com/articles/vanilla-devops-git-credentials-cheatsheet/
 */
export function getAuthenticationRules(
  gitUrl: string,
  token: string
): AuthenticationRule[] {
  const authenticationRules = [];
  const hasUser = token.split(':').length > 1;
  const parsedUrl = GitUrlParse(gitUrl);
  const protocol = regEx(/^https?$/).exec(parsedUrl.protocol)
    ? parsedUrl.protocol
    : 'https';

  // https protocol
  authenticationRules.push({
    url: `${protocol}://${hasUser ? token : `api:${token}`}@${
      parsedUrl.resource
    }/`,
    insteadOf: `${protocol}://${parsedUrl.resource}/`,
  });

  // ssh protocol
  authenticationRules.push({
    url: `${protocol}://${hasUser ? token : `ssh:${token}`}@${
      parsedUrl.resource
    }/`,
    insteadOf: `ssh://git@${parsedUrl.resource}/`,
  });

  // alternative ssh protocol
  authenticationRules.push({
    url: `${protocol}://${hasUser ? token : `git:${token}`}@${
      parsedUrl.resource
    }/`,
    insteadOf: `git@${parsedUrl.resource}:`,
  });

  return authenticationRules;
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
