import { PlatformId } from '../../../constants';
import { CONFIG_GIT_URL_UNAVAILABLE } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import * as hostRules from '../../../util/host-rules';
import { regEx } from '../../../util/regex';
import { parseUrl } from '../../../util/url';
import type { GitUrlOption } from '../types';
import type { Repo } from './gitea-helper';

export function smartLinks(body: string): string {
  return body?.replace(regEx(/\]\(\.\.\/pull\//g), '](pulls/');
}

export function trimTrailingApiPath(url: string): string {
  return url?.replace(regEx(/api\/v1\/?$/g), '');
}

export function getRepoUrl(
  repo: Repo,
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
  const opts = hostRules.find({
    hostType: PlatformId.Gitea,
    url: endpoint,
  });

  if (gitUrl === 'endpoint') {
    const url = parseUrl(endpoint);
    if (!url) {
      throw new Error(CONFIG_GIT_URL_UNAVAILABLE);
    }
    url.protocol = url.protocol?.slice(0, -1) ?? 'https';
    url.username = opts.token ?? '';
    url.pathname = `${url.pathname}${repo.full_name}.git`;
    logger.debug(
      { url: url.toString() },
      'using URL based on configured endpoint'
    );
    return url.toString();
  }

  if (!repo.clone_url) {
    throw new Error(CONFIG_GIT_URL_UNAVAILABLE);
  }

  logger.debug({ url: repo.clone_url }, `using HTTP URL`);
  const repoUrl = parseUrl(repo.clone_url);
  if (!repoUrl) {
    throw new Error(CONFIG_GIT_URL_UNAVAILABLE);
  }
  repoUrl.username = opts.token ?? '';
  return repoUrl.toString();
}
