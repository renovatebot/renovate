import gitUrlParse from 'git-url-parse';
import { logger } from '../../logger';
import { detectPlatform } from '../common';
import * as hostRules from '../host-rules';
import { regEx } from '../regex';

export function parseGitUrl(url: string): gitUrlParse.GitUrl {
  const parsed = gitUrlParse(url);

  // Workaround for https://github.com/IonicaBizau/parse-path/issues/38
  if (parsed.port && parsed.resource.endsWith(`:${parsed.port}`)) {
    parsed.resource = parsed.resource.substring(
      0,
      parsed.resource.length - `:${parsed.port}`.length
    );
  }

  return parsed;
}

export function getHttpUrl(url: string, token?: string): string {
  const parsedUrl = parseGitUrl(url);

  parsedUrl.token = token ?? '';

  if (token) {
    switch (detectPlatform(url)) {
      case 'gitlab':
        parsedUrl.token = token.includes(':')
          ? token
          : `gitlab-ci-token:${token}`;
    }
  }

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
