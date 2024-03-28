import {logger} from '../../../logger';
import type {BranchStatus, PrState} from '../../../types';
import * as hostRules from '../../../util/host-rules';
import {joinUrlParts} from '../../../util/url';
import {mapGerritChangeStateToPrState} from "../gerrit/utils";
import {hashBody} from "../pr-body";
import type {Pr} from '../types';
import type {GerritChange, GerritLabelTypeInfo, SpaceCodeReviewState, SpaceMergeRequestRecord,} from './types';

export const TAG_PULL_REQUEST_BODY = 'pull-request';

export function getSpaceRepoUrl(repository: string, endpoint: string): string {
  logger.debug(`getSpaceRepoUrl: repository=${repository}, endpoint=${endpoint}`);
  const orgName = endpoint.split('.')[0]

  // Find options for current host and determine Git endpoint
  const opts = hostRules.find({
    hostType: 'space',
    url: endpoint,
  });

  const url = new URL('https://git.jetbrains.space');
  if (!opts.token) {
    throw new Error(
      'Init: You must configure a JetBrains Space token',
    );
  }
  url.username = 'username-doesnt-matter';
  url.password = opts.token;
  url.pathname = joinUrlParts(
    orgName,
    repository
  );

  logger.debug(
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
    reviewers:
      change.reviewers?.REVIEWER?.filter(
        (reviewer) => typeof reviewer.username === 'string',
      ).map((reviewer) => reviewer.username!) ?? [],
    bodyStruct: {
      hash: hashBody(findPullRequestBody(change)),
    },
  };
}


export function mapSpaceCodeReviewDetailsToPr(details: SpaceMergeRequestRecord, body: string): Pr {
  return {
    number: details.number,
    state: mapSpaceCodeReviewStateToPrState(details.state, details.canBeReopened ?? false),
    sourceBranch: details.branchPairs[0].sourceBranch,
    targetBranch: details.branchPairs[0].targetBranch,
    title: details.title,
    // reviewers:
    //   change.reviewers?.REVIEWER?.filter(
    //     (reviewer) => typeof reviewer.username === 'string',
    //   ).map((reviewer) => reviewer.username!) ?? [],
    // TODO: find how to retrieve pr description?
    bodyStruct: {
      hash: hashBody(body),
    },
  };
}

export function mapSpaceCodeReviewStateToPrState(
  state: SpaceCodeReviewState, canBeReopened: boolean
): PrState {
  switch (state) {
    case 'Opened':
      return 'open';
    case 'Closed':
      if (canBeReopened) {
        return 'closed';
      } else {
        return 'merged';
      }
    case "Deleted":
      // should not normally be here
      return 'closed';
  }
  return 'all';
}
export function extractSourceBranch(change: GerritChange): string | undefined {
  return change.hashtags
    ?.find((tag) => tag.startsWith('sourceBranch-'))
    ?.replace('sourceBranch-', '');
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
  state: BranchStatus,
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
  // istanbul ignore next
  return label.default_value;
}
