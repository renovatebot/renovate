import { CONFIG_GIT_URL_UNAVAILABLE } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import type { PrState } from '../../../types';
import * as hostRules from '../../../util/host-rules';
import { parseUrl } from '../../../util/url';
import { hashBody } from '../pr-body';
import type { Pr } from '../types';
import type { GerritChange, GerritChangeStatus } from './types';
import { TAG_PULL_REQUEST_BODY } from './types';

export function getGerritRepoUrl(repository: string, endpoint: string): string {
  // Find options for current host and determine Git endpoint
  const opts = hostRules.find({
    hostType: 'gerrit',
    url: endpoint,
  });

  const url = parseUrl(endpoint);
  if (!url) {
    throw new Error(CONFIG_GIT_URL_UNAVAILABLE);
  }
  url.protocol = url.protocol.slice(0, -1);
  url.username = opts.username ?? '';
  url.password = opts.password ?? '';
  url.pathname = `${url.pathname}a/${repository}`;
  logger.debug(
    { url: url.toString() },
    'using URL based on configured endpoint'
  );
  return url.toString();
}

export function mapPrStateToGerritFilter(state?: PrState): string {
  switch (state) {
    case 'closed':
      return 'status:closed';
    case 'merged':
      return 'status:merged';
    case '!open':
      return '-status:open';
    case 'open':
      return 'status:open';
    case 'all':
    default:
      return '-is:wip';
  }
}

export function mapGerritChangeToPr(change: GerritChange): Pr {
  return {
    number: change._number,
    state: mapGerritChangeStateToPrState(change.status),
    sourceBranch: extractSourceBranch(change) ?? change.branch,
    targetBranch: change.branch,
    title: change.subject,
    hasReviewers: change.reviewers !== undefined,
    bodyStruct: {
      hash: hashBody(findPullRequestBody(change)),
    },
  };
}

export function mapGerritChangeStateToPrState(
  state: GerritChangeStatus
): PrState {
  switch (state) {
    case 'NEW':
      return 'open';
    case 'MERGED':
      return 'merged';
    case 'ABANDONED':
      return 'closed';
  }
  // istanbul ignore next
  return 'all';
}

export function extractSourceBranch(change: GerritChange): string | undefined {
  return change.hashtags
    ?.filter((tag) => tag.startsWith('sourceBranch-'))
    .map((tag) => tag.replace('sourceBranch-', ''))
    .shift();
}

export function findPullRequestBody(change: GerritChange): string | undefined {
  const msg = change.messages
    ?.filter((msg) => msg.tag === TAG_PULL_REQUEST_BODY)
    .pop();
  if (msg) {
    return msg.message.replace(/^Patch Set \d+:\n\n/, ''); //TODO: check how to get rid of the auto-added prefix?
  }
  return undefined;
}
