import URL from 'url';
import { PlatformId } from '../../../constants';
import { CONFIG_GIT_URL_UNAVAILABLE } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import type { HostRule } from '../../../types';
import * as hostRules from '../../../util/host-rules';
import { regEx } from '../../../util/regex';
import { parseUrl } from '../../../util/url';
import type { GitUrlOption } from '../types';
import type * as helper from './gitea-helper';

export function smartLinks(body: string): string {
  return body?.replace(regEx(/\]\(\.\.\/pull\//g), '](pulls/');
}

export function getRepoUrl(
  repo: helper.Repo,
  gitUrl: GitUrlOption | undefined,
  endpoint: string
): string {
  if (gitUrl === 'ssh') {
    if (!repo.ssh_url) {
      throw new Error(CONFIG_GIT_URL_UNAVAILABLE);
    }
    logger.debug({ url: repo.ssh_url }, `using SSH URL`);
    return repo.ssh_url;
  }

  // Find options for current host and determine Git endpoint
  const opts: HostRule = hostRules.find({
    hostType: PlatformId.Gitea,
    url: endpoint,
  });

  if (gitUrl === 'endpoint' || repo.clone_url === null) {
    if (repo.clone_url === null) {
      logger.debug('No clone_url found. Falling back to old behaviour.');
    }

    const { protocol, host, pathname } = parseUrl(endpoint);
    const newPathname = pathname.slice(0, pathname.indexOf('/api'));
    const url = URL.format({
      protocol: protocol.slice(0, -1) || 'https',
      auth: opts.token,
      host,
      pathname: newPathname + '/' + repo.full_name + '.git',
    });
    logger.debug({ url }, 'using URL based on configured endpoint');
    return url;
  }

  logger.debug({ url: repo.clone_url }, `using HTTP URL`);
  const repoUrl = URL.parse(`${repo.clone_url}`);
  repoUrl.auth = opts.token;
  return URL.format(repoUrl);
}
