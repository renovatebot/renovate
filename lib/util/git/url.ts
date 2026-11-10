import gitUrlParse from 'git-url-parse';
import { logger } from '../../logger/index.ts';
import { detectPlatform } from '../common.ts';
import * as hostRules from '../host-rules.ts';
import { regEx } from '../regex.ts';
import { parseUrl } from '../url.ts';

export function parseGitUrl(url: string): gitUrlParse.GitUrl {
  return gitUrlParse(url);
}

/**
 * Gives a token without a `:` the username and non-empty password expected by the given platform.
 * Tokens containing a `:` and tokens of other platforms are returned unchanged.
 */
export function getTokenCredentials(
  platform: string | null | undefined,
  token: string,
): string {
  if (token.includes(':')) {
    return token;
  }
  switch (platform) {
    case 'gitlab':
      return `gitlab-ci-token:${token}`;
    case 'azure':
    case 'github':
    case 'scm-manager':
      return `x-access-token:${token}`;
    case 'bitbucket':
    case 'bitbucket-server':
      return `x-token-auth:${token}`;
    case 'gitea':
    case 'forgejo':
      return `${token}:x-oauth-basic`;
    default:
      return token;
  }
}

export function getHttpUrl(url: string, token?: string): string {
  const parsedUrl = parseGitUrl(url);

  let { protocol } = parsedUrl;
  const origProtocol = protocol;

  // Convert non-https URLs to https and strip port
  if (!regEx(/^https?$/).test(protocol)) {
    parsedUrl.port = '443';
    protocol = 'https';
  }

  parsedUrl.user = '';
  parsedUrl.token = token ?? '';

  const platform = detectPlatform(parsedUrl.toString(protocol));
  if (token) {
    parsedUrl.token = getTokenCredentials(platform, token);
    // git-url-parse would prefix `x-token-auth:` again on bitbucket.org
    if (parsedUrl.source === 'bitbucket.org') {
      parsedUrl.source = 'bitbucket';
    }
  }

  switch (platform) {
    case 'bitbucket-server':
      // SSH URLs look like ssh://git@git.my.com:7999/project/repo.git
      // HTTPS URLs look like https://git.my.com/scm/project/repo.git
      // git-url-parse can't detect bitbucket-server from SSH URL
      // and thus doesn't know it should insert '/scm/'
      // v8 ignore else -- TODO: add test #40625
      if (origProtocol === 'ssh') {
        parsedUrl.source = 'bitbucket-server';
      }
      break;
  }

  const httpUrl = parseUrl(parsedUrl.toString(protocol));
  // v8 ignore if: git-url-parse always produces a parseable URL string
  if (!httpUrl) {
    throw new Error(`Failed to parse git URL: ${parsedUrl.toString(protocol)}`);
  }
  return httpUrl.href;
}

export function getRemoteUrlWithToken(url: string, hostType?: string): string {
  let coercedUrl: string;

  try {
    coercedUrl = getHttpUrl(url);
  } catch {
    logger.warn({ url }, `Attempting to use non-git url for git operations`);

    coercedUrl = url;
  }

  const hostRule = hostRules.find({ url: coercedUrl, hostType });

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
