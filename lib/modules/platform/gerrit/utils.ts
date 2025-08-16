import { CONFIG_GIT_URL_UNAVAILABLE } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import type { BranchStatus, PrState } from '../../../types';
import type { LongCommitSha } from '../../../util/git/types';
import * as hostRules from '../../../util/host-rules';
import { regEx } from '../../../util/regex';
import { joinUrlParts, parseUrl } from '../../../util/url';
import { hashBody } from '../pr-body';
import type { Pr } from '../types';
import type {
  GerritChange,
  GerritChangeStatus,
  GerritLabelTypeInfo,
  GerritRequestDetail,
} from './types';

export const TAG_PULL_REQUEST_BODY = 'pull-request';

export const REQUEST_DETAILS_FOR_PRS: GerritRequestDetail[] = [
  'MESSAGES', // to get the pr body
  'LABELS', // to get the reviewers
  'DETAILED_ACCOUNTS', // to get the reviewers usernames
  'CURRENT_REVISION', // to get the commit message
  'COMMIT_FOOTERS', // to get the commit message
] as const;

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

export function mapPrStateToGerritFilter(state?: PrState): string | null {
  switch (state) {
    case 'merged':
      return 'status:merged';
    case 'open':
      return 'status:open';
    case 'closed':
      return 'status:abandoned';
    case '!open':
      return '-status:open';
    case 'all':
    default:
      return null;
  }
}

export function mapGerritChangeToPr(
  change: GerritChange,
  knownProperties?: {
    sourceBranch?: string;
    prBody?: string;
  },
): Pr | null {
  const sourceBranch =
    knownProperties?.sourceBranch ?? extractSourceBranch(change);
  if (!sourceBranch) {
    return null;
  }
  return {
    number: change._number,
    state: mapGerritChangeStateToPrState(change.status),
    sourceBranch,
    targetBranch: change.branch,
    title: change.subject,
    createdAt: change.created?.replace(' ', 'T'),
    labels: change.hashtags,
    reviewers:
      change.reviewers?.REVIEWER?.map((reviewer) => reviewer.username!) ?? [],
    bodyStruct: {
      hash: hashBody(knownProperties?.prBody ?? findPullRequestBody(change)),
    },
    sha: change.current_revision as LongCommitSha,
  };
}

export function mapGerritChangeStateToPrState(
  state: GerritChangeStatus,
): 'merged' | 'open' | 'closed' {
  switch (state) {
    case 'NEW':
      return 'open';
    case 'MERGED':
      return 'merged';
    case 'ABANDONED':
      return 'closed';
  }
}

export function extractSourceBranch(change: GerritChange): string | undefined {
  let sourceBranch: string | undefined = undefined;

  if (change.current_revision) {
    const re = regEx(/^Renovate-Branch: (.+)$/m);
    const currentRevision = change.revisions![change.current_revision];
    const message = currentRevision.commit_with_footers;
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
  const numbers = Object.keys(label.values).map((x) => parseInt(x));
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
