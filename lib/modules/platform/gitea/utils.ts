import type { MergeStrategy } from '../../../config/types';
import { CONFIG_GIT_URL_UNAVAILABLE } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import * as hostRules from '../../../util/host-rules';
import { regEx } from '../../../util/regex';
import { parseUrl } from '../../../util/url';
import type { GitUrlOption } from '../types';
import type { PRMergeMethod, Repo } from './types';

export function smartLinks(body: string): string {
  return body?.replace(regEx(/\]\(\.\.\/pull\//g), '](pulls/');
}

export function trimTrailingApiPath(url: string): string {
  return url?.replace(regEx(/api\/v1\/?$/g), '');
}

export function getRepoUrl(
  repo: Repo,
  gitUrl: GitUrlOption | undefined,
  endpoint: string,
): string {
  if (gitUrl === 'ssh') {
    if (!repo.ssh_url) {
      throw new Error(CONFIG_GIT_URL_UNAVAILABLE);
    }
    logger.debug(`Using SSH URL: ${repo.ssh_url}`);
    return repo.ssh_url;
  }

  // Find options for current host and determine Git endpoint
  const opts = hostRules.find({
    hostType: 'gitea',
    url: endpoint,
  });

  if (gitUrl === 'endpoint') {
    const url = parseUrl(endpoint);
    if (!url) {
      throw new Error(CONFIG_GIT_URL_UNAVAILABLE);
    }
    url.username = opts.token ?? '';
    url.pathname = `${url.pathname}${repo.full_name}.git`;
    logger.debug(
      { url: url.toString() },
      'using URL based on configured endpoint',
    );
    return url.toString();
  }

  if (!repo.clone_url) {
    throw new Error(CONFIG_GIT_URL_UNAVAILABLE);
  }

  logger.debug(`Using HTTP URL: ${repo.clone_url}`);
  const repoUrl = parseUrl(repo.clone_url);
  if (!repoUrl) {
    throw new Error(CONFIG_GIT_URL_UNAVAILABLE);
  }
  repoUrl.username = opts.token ?? '';
  return repoUrl.toString();
}

export function getMergeMethod(
  strategy: MergeStrategy | undefined,
): PRMergeMethod | null {
  switch (strategy) {
    case 'fast-forward':
      return 'rebase';
    case 'merge-commit':
      return 'merge';
    case 'rebase':
      return 'rebase-merge';
    case 'squash':
      return strategy;
    case 'auto':
    default:
      return null;
  }
}
