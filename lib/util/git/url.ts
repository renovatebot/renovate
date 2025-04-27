import gitUrlParse from 'git-url-parse';
import { logger } from '../../logger';
import { detectPlatform } from '../common';
import * as hostRules from '../host-rules';
import { regEx } from '../regex';

export function parseGitUrl(url: string): gitUrlParse.GitUrl {
  return gitUrlParse(url);
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

  switch (detectPlatform(parsedUrl.toString(protocol))) {
    case 'gitlab':
      if (token) {
        parsedUrl.token = token.includes(':')
          ? token
          : `gitlab-ci-token:${token}`;
      }
      break;
    case 'github':
      if (token) {
        parsedUrl.token = token.includes(':')
          ? token
          : `x-access-token:${token}`;
      }
      break;
    case 'bitbucket-server':
      // SSH URLs look like ssh://git@git.my.com:7999/project/repo.git
      // HTTPS URLs look like https://git.my.com/scm/project/repo.git
      // git-url-parse can't detect bitbucket-server from SSH URL
      // and thus doesn't know it should insert '/scm/'
      if (origProtocol === 'ssh') {
        parsedUrl.source = 'bitbucket-server';
      }
      break;
  }

  return new URL(parsedUrl.toString(protocol)).href;
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
