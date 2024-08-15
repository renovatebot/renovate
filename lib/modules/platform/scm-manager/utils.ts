import type { MergeStrategy } from '../../../config/types';
import { logger } from '../../../logger';
import * as hostRules from '../../../util/host-rules';
import { regEx } from '../../../util/regex';
import { parseUrl } from '../../../util/url';
import type { GitUrlOption, Pr } from '../types';
import type { PrFilterByState, PrMergeMethod, Repo } from './types';

export function mapPrState(
  state: 'open' | 'closed' | undefined,
): 'OPEN' | 'REJECTED' | undefined {
  switch (state) {
    case 'open':
      return 'OPEN';
    case 'closed':
      return 'REJECTED';
    default:
      return undefined;
  }
}

export function matchPrState(pr: Pr, state: PrFilterByState): boolean {
  if (state === 'all') {
    return true;
  }

  if (state === 'open' && (pr.state === 'OPEN' || pr.state === 'DRAFT')) {
    return true;
  }

  if (state === '!open' && (pr.state === 'MERGED' || pr.state === 'REJECTED')) {
    return true;
  }

  if (
    state === 'closed' &&
    (pr.state === 'MERGED' || pr.state === 'REJECTED')
  ) {
    return true;
  }

  return false;
}

export function smartLinks(body: string): string {
  return body.replace(regEx(/\]\(\.\.\/pull\//g), '](pulls/');
}

export function getRepoUrl(
  repo: Repo,
  gitUrl: GitUrlOption | undefined,
  endpoint: string,
): string {
  const protocolLinks = repo._links.protocol;

  if (!protocolLinks) {
    throw new Error('Missing protocol links.');
  }

  if (!Array.isArray(protocolLinks)) {
    throw new Error('Expected protocol links to be an array of links.');
  }

  if (gitUrl === 'ssh') {
    const sshUrl = protocolLinks.find((l) => l.name === 'ssh')?.href;
    if (!sshUrl) {
      throw new Error('MISSING_SSH_LINKS');
    }

    logger.debug(`Using SSH URL: ${sshUrl}`);
    return sshUrl;
  }

  const httpUrl = protocolLinks.find((l) => l.name === 'http')?.href;
  if (!httpUrl) {
    throw new Error('MISSING_HTTP_LINK');
  }

  logger.debug(`Using HTTP URL: ${httpUrl}`);

  const repoUrl = parseUrl(httpUrl);
  if (!repoUrl) {
    throw new Error('MALFORMED_HTTP_LINK');
  }

  const hostOptions = hostRules.find({
    hostType: 'scm-manager',
    url: endpoint,
  });

  repoUrl.username = hostOptions.username ?? '';
  repoUrl.password = hostOptions.token ?? '';

  return repoUrl.toString();
}

export function getMergeMethod(
  strategy: MergeStrategy | undefined,
): PrMergeMethod | null {
  switch (strategy) {
    case 'fast-forward':
      return 'FAST_FORWARD_IF_POSSIBLE';
    case 'merge-commit':
      return 'MERGE_COMMIT';
    case 'rebase':
      return 'REBASE';
    case 'squash':
      return 'SQUASH';
    default:
      return null;
  }
}
