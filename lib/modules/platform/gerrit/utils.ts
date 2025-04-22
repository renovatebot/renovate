import { CONFIG_GIT_URL_UNAVAILABLE } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import type { BranchStatus, PrState } from '../../../types';
import * as hostRules from '../../../util/host-rules';
import { regEx } from '../../../util/regex';
import { joinUrlParts, parseUrl } from '../../../util/url';
import { hashBody } from '../pr-body';
import type { Pr } from '../types';
import type {
  GerritChange,
  GerritChangeStatus,
  GerritLabelTypeInfo,
} from './types';

export const TAG_PULL_REQUEST_BODY = 'pull-request';

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
  if (!(opts.username && opts.password)) {
    throw new Error(
      'Init: You must configure a Gerrit Server username/password',
    );
  }
  url.username = opts.username;
  url.password = opts.password;
  url.pathname = joinUrlParts(
    url.pathname,
    'a',
    encodeURIComponent(repository),
  );
  logger.trace(
    { url: url.toString() },
    'using URL based on configured endpoint',
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
    createdAt: change.created?.replace(' ', 'T'),
    reviewers:
      change.reviewers?.REVIEWER?.filter(
        (reviewer) => typeof reviewer.username === 'string',
      ).map((reviewer) => reviewer.username!) ?? [],
    bodyStruct: {
      hash: hashBody(findPullRequestBody(change)),
    },
  };
}

export function mapGerritChangeStateToPrState(
  state: GerritChangeStatus | 'UNKNOWN', // suppress default path code removal
): PrState {
  switch (state) {
    case 'NEW':
      return 'open';
    case 'MERGED':
      return 'merged';
    case 'ABANDONED':
      return 'closed';
  }
  return 'all';
}
export function extractSourceBranch(change: GerritChange): string | undefined {
  let sourceBranch: string | undefined = undefined;

  if (change.current_revision) {
    const re = regEx(/^Renovate-Branch: (.+)$/m);
    const message = change.revisions[change.current_revision]?.commit?.message;
    if (message) {
      sourceBranch = re.exec(message)?.[1];
    }
  }

  return sourceBranch ?? undefined;
}

export function findPullRequestBody(change: GerritChange): string | undefined {
  const msg = Array.from(change.messages ?? [])
    .reverse()
    .find((msg) => msg.tag === TAG_PULL_REQUEST_BODY);
  if (msg) {
    return msg.message.replace(/^Patch Set \d+:\n\n/, ''); //TODO: check how to get rid of the auto-added prefix?
  }
  return undefined;
}

export function mapBranchStatusToLabel(
  state: BranchStatus | 'UNKNOWN', // suppress default path code removal
  label: GerritLabelTypeInfo,
): number {
  const numbers = Object.keys(label.values).map((x) => parseInt(x, 10));
  switch (state) {
    case 'green':
      return Math.max(...numbers);
    case 'yellow':
    case 'red':
      return Math.min(...numbers);
  }
  /* v8 ignore next */
  return label.default_value;
}
