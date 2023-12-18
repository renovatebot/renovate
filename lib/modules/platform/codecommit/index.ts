import { Buffer } from 'node:buffer';
import {
  GetCommentsForPullRequestOutput,
  ListRepositoriesOutput,
  PullRequestStatusEnum,
} from '@aws-sdk/client-codecommit';
import {
  PLATFORM_BAD_CREDENTIALS,
  REPOSITORY_EMPTY,
  REPOSITORY_NOT_FOUND,
} from '../../../constants/error-messages';
import { logger } from '../../../logger';
import type { BranchStatus, PrState } from '../../../types';
import { coerceArray } from '../../../util/array';
import { parseJson } from '../../../util/common';
import * as git from '../../../util/git';
import { regEx } from '../../../util/regex';
import { sanitize } from '../../../util/sanitize';
import type {
  BranchStatusConfig,
  CreatePRConfig,
  EnsureCommentConfig,
  EnsureCommentRemovalConfig,
  EnsureIssueConfig,
  EnsureIssueResult,
  FindPRConfig,
  Issue,
  MergePRConfig,
  PlatformParams,
  PlatformResult,
  Pr,
  RepoParams,
  RepoResult,
  UpdatePrConfig,
} from '../types';
import { getNewBranchName, repoFingerprint } from '../util';
import { smartTruncate } from '../utils/pr-body';
import * as client from './codecommit-client';

export interface CodeCommitPr extends Pr {
  body: string;
  destinationCommit: string;
  sourceCommit: string;
}

interface Config {
  repository?: string;
  defaultBranch?: string;
  region?: string;
  prList?: CodeCommitPr[];
}

export const id = 'codecommit';

export const config: Config = {};

export async function initPlatform({
  endpoint,
  username,
  password,
  token: awsToken,
}: PlatformParams): Promise<PlatformResult> {
  const accessKeyId = username;
  const secretAccessKey = password;
  let region: string | undefined;

  if (accessKeyId) {
    process.env.AWS_ACCESS_KEY_ID = accessKeyId;
  }
  if (secretAccessKey) {
    process.env.AWS_SECRET_ACCESS_KEY = secretAccessKey;
  }
  if (awsToken) {
    process.env.AWS_SESSION_TOKEN = awsToken;
  }

  if (endpoint) {
    const regionReg = regEx(/.*codecommit\.(?<region>.+)\.amazonaws\.com/);
    const codeCommitMatch = regionReg.exec(endpoint);
    region = codeCommitMatch?.groups?.region;
    if (region) {
      process.env.AWS_REGION = region;
    } else {
      logger.warn("Can't parse region, make sure your endpoint is correct");
    }
  }

  // If any of the below fails, it will throw an exception stopping the program.
  client.buildCodeCommitClient();
  // To check if we have permission to codecommit, throws exception if failed.
  await client.listRepositories();

  const platformConfig: PlatformResult = {
    endpoint:
      endpoint ??
      `https://git-codecommit.${
        process.env.AWS_REGION ?? 'us-east-1'
      }.amazonaws.com/`,
  };
  return Promise.resolve(platformConfig);
}

export async function initRepo({
  repository,
  endpoint,
}: RepoParams): Promise<RepoResult> {
  logger.debug(`initRepo("${repository}")`);

  config.repository = repository;

  let repo;
  try {
    repo = await client.getRepositoryInfo(repository);
  } catch (err) {
    logger.error({ err }, 'Could not find repository');
    throw new Error(REPOSITORY_NOT_FOUND);
  }

  if (!repo?.repositoryMetadata) {
    logger.error({ repository }, 'Could not find repository');
    throw new Error(REPOSITORY_NOT_FOUND);
  }
  logger.debug({ repositoryDetails: repo }, 'Repository details');
  const metadata = repo.repositoryMetadata;

  const url = client.getCodeCommitUrl(metadata, repository);
  try {
    await git.initRepo({
      url,
    });
  } catch (err) {
    logger.debug({ err }, 'Failed to git init');
    throw new Error(PLATFORM_BAD_CREDENTIALS);
  }

  if (!metadata.defaultBranch || !metadata.repositoryId) {
    logger.debug('Repo is empty');
    throw new Error(REPOSITORY_EMPTY);
  }

  const defaultBranch = metadata.defaultBranch;
  config.defaultBranch = defaultBranch;
  logger.debug(`${repository} default branch = ${defaultBranch}`);

  return {
    repoFingerprint: repoFingerprint(metadata.repositoryId, endpoint),
    defaultBranch,
    isFork: false,
  };
}

export async function getPrList(): Promise<CodeCommitPr[]> {
  logger.debug('getPrList()');

  if (config.prList) {
    return config.prList;
  }

  const listPrsResponse = await client.listPullRequests(config.repository!);
  const fetchedPrs: CodeCommitPr[] = [];

  if (listPrsResponse && !listPrsResponse.pullRequestIds) {
    return fetchedPrs;
  }

  const prIds = coerceArray(listPrsResponse.pullRequestIds);

  for (const prId of prIds) {
    const prRes = await client.getPr(prId);

    if (!prRes?.pullRequest) {
      continue;
    }
    const prInfo = prRes.pullRequest;
    const pr: CodeCommitPr = {
      targetBranch: prInfo.pullRequestTargets![0].destinationReference!,
      sourceBranch: prInfo.pullRequestTargets![0].sourceReference!,
      destinationCommit: prInfo.pullRequestTargets![0].destinationCommit!,
      sourceCommit: prInfo.pullRequestTargets![0].sourceCommit!,
      state:
        prInfo.pullRequestStatus === PullRequestStatusEnum.OPEN
          ? 'open'
          : 'closed',
      number: Number.parseInt(prId),
      title: prInfo.title!,
      body: prInfo.description!,
    };
    fetchedPrs.push(pr);
  }

  config.prList = fetchedPrs;

  logger.debug(`Retrieved Pull Requests, count: ${fetchedPrs.length}`);
  return fetchedPrs;
}

export async function findPr({
  branchName,
  prTitle,
  state = 'all',
}: FindPRConfig): Promise<CodeCommitPr | null> {
  let prsFiltered: CodeCommitPr[] = [];
  try {
    const prs = await getPrList();
    const refsHeadBranchName = getNewBranchName(branchName);
    prsFiltered = prs.filter(
      (item) => item.sourceBranch === refsHeadBranchName,
    );

    if (prTitle) {
      prsFiltered = prsFiltered.filter(
        (item) => item.title.toUpperCase() === prTitle.toUpperCase(),
      );
    }

    switch (state) {
      case 'all':
        break;
      case '!open':
        prsFiltered = prsFiltered.filter((item) => item.state !== 'open');
        break;
      default:
        prsFiltered = prsFiltered.filter((item) => item.state === 'open');
        break;
    }
  } catch (err) {
    logger.error({ err }, 'findPr error');
  }
  if (prsFiltered.length === 0) {
    return null;
  }
  return prsFiltered[0];
}

export async function getBranchPr(
  branchName: string,
): Promise<CodeCommitPr | null> {
  logger.debug(`getBranchPr(${branchName})`);
  const existingPr = await findPr({
    branchName,
    state: 'open',
  });
  return existingPr ? getPr(existingPr.number) : null;
}

export async function getPr(
  pullRequestId: number,
): Promise<CodeCommitPr | null> {
  logger.debug(`getPr(${pullRequestId})`);
  const prRes = await client.getPr(`${pullRequestId}`);

  if (!prRes?.pullRequest) {
    return null;
  }

  const prInfo = prRes.pullRequest;
  let prState: PrState;
  if (prInfo.pullRequestTargets![0].mergeMetadata?.isMerged) {
    prState = 'merged';
  } else {
    prState =
      prInfo.pullRequestStatus === PullRequestStatusEnum.OPEN
        ? 'open'
        : 'closed';
  }

  return {
    sourceBranch: prInfo.pullRequestTargets![0].sourceReference!,
    sourceCommit: prInfo.pullRequestTargets![0].sourceCommit!,
    state: prState,
    number: pullRequestId,
    title: prInfo.title!,
    targetBranch: prInfo.pullRequestTargets![0].destinationReference!,
    destinationCommit: prInfo.pullRequestTargets![0].destinationCommit!,
    body: prInfo.description!,
  };
}

export async function getRepos(): Promise<string[]> {
  logger.debug('Autodiscovering AWS CodeCommit repositories');

  let reposRes: ListRepositoriesOutput;
  try {
    reposRes = await client.listRepositories();
    //todo do we need pagination? maximum number of repos is 1000 without pagination, also the same for free account
  } catch (error) {
    logger.error({ error }, 'Could not retrieve repositories');
    return [];
  }

  const res: string[] = [];

  const repoNames = coerceArray(reposRes?.repositories);

  for (const repo of repoNames) {
    if (repo.repositoryName) {
      res.push(repo.repositoryName);
    }
  }

  return res;
}

export function massageMarkdown(input: string): string {
  // Remove any HTML we use
  return input
    .replace(
      'you tick the rebase/retry checkbox',
      'rename PR to start with "rebase!"',
    )
    .replace(
      'checking the rebase/retry box above',
      'renaming the PR to start with "rebase!"',
    )
    .replace(regEx(/<\/?summary>/g), '**')
    .replace(regEx(/<\/?details>/g), '')
    .replace(regEx(`\n---\n\n.*?<!-- rebase-check -->.*?\n`), '')
    .replace(regEx(/\]\(\.\.\/pull\//g), '](../../pull-requests/')
    .replace(
      regEx(/(?<hiddenComment><!--renovate-(?:debug|config-hash):.*?-->)/g),
      '[//]: # ($<hiddenComment>)',
    );
}

export async function getJsonFile(
  fileName: string,
  repoName?: string,
  branchOrTag?: string,
): Promise<any> {
  const raw = await getRawFile(fileName, repoName, branchOrTag);
  return parseJson(raw, fileName);
}

export async function getRawFile(
  fileName: string,
  repoName?: string,
  branchOrTag?: string,
): Promise<string | null> {
  const fileRes = await client.getFile(
    repoName ?? config.repository,
    fileName,
    branchOrTag,
  );
  if (!fileRes?.fileContent) {
    return null;
  }
  const buf = Buffer.from(fileRes.fileContent);
  return buf.toString();
}

/* istanbul ignore next */
export function getRepoForceRebase(): Promise<boolean> {
  return Promise.resolve(false);
}

const AMAZON_MAX_BODY_LENGTH = 10239;

export async function createPr({
  sourceBranch,
  targetBranch,
  prTitle: title,
  prBody: body,
}: CreatePRConfig): Promise<CodeCommitPr> {
  const description = smartTruncate(sanitize(body), AMAZON_MAX_BODY_LENGTH);

  const prCreateRes = await client.createPr(
    title,
    sanitize(description),
    sourceBranch,
    targetBranch,
    config.repository,
  );

  if (
    !prCreateRes.pullRequest?.title ||
    !prCreateRes.pullRequest?.pullRequestId ||
    !prCreateRes.pullRequest?.description ||
    !prCreateRes.pullRequest?.pullRequestTargets?.length
  ) {
    throw new Error('Could not create pr, missing PR info');
  }

  return {
    number: Number.parseInt(prCreateRes.pullRequest.pullRequestId),
    state: 'open',
    title: prCreateRes.pullRequest.title,
    sourceBranch,
    targetBranch,
    sourceCommit: prCreateRes.pullRequest.pullRequestTargets[0].sourceCommit!,
    destinationCommit:
      prCreateRes.pullRequest.pullRequestTargets[0].destinationCommit!,
    sourceRepo: config.repository,
    body: prCreateRes.pullRequest.description,
  };
}

export async function updatePr({
  number: prNo,
  prTitle: title,
  prBody: body,
  state,
}: UpdatePrConfig): Promise<void> {
  logger.debug(`updatePr(${prNo}, ${title}, body)`);

  let cachedPr: CodeCommitPr | undefined = undefined;
  const cachedPrs = config.prList ?? [];
  for (const p of cachedPrs) {
    if (p.number === prNo) {
      cachedPr = p;
    }
  }

  if (body && cachedPr?.body !== body) {
    await client.updatePrDescription(
      `${prNo}`,
      smartTruncate(sanitize(body), AMAZON_MAX_BODY_LENGTH),
    );
  }

  if (title && cachedPr?.title !== title) {
    await client.updatePrTitle(`${prNo}`, title);
  }

  const prStatusInput =
    state === 'closed'
      ? PullRequestStatusEnum.CLOSED
      : PullRequestStatusEnum.OPEN;
  if (cachedPr?.state !== prStatusInput) {
    try {
      await client.updatePrStatus(`${prNo}`, prStatusInput);
    } catch (err) {
      // safety check
      // do nothing, it's ok to fail sometimes when trying to update from open to open or from closed to closed.
    }
  }
}

// Auto-Merge not supported currently.
/* istanbul ignore next */
export async function mergePr({
  branchName,
  id: prNo,
  strategy,
}: MergePRConfig): Promise<boolean> {
  logger.debug(`mergePr(${prNo}, ${branchName!})`);
  await client.getPr(`${prNo}`);
  return Promise.resolve(false);
  //
  // // istanbul ignore if
  // if (!prOut) {
  //   return false;
  // }
  // const pReq = prOut.pullRequest;
  // const targets = pReq?.pullRequestTargets;
  //
  // // istanbul ignore if
  // if (!targets) {
  //   return false;
  // }
  //
  // if (strategy === 'rebase') {
  //   logger.warn('CodeCommit does not support a "rebase" strategy.');
  //   return false;
  // }
  //
  // try {
  //   if (strategy === 'auto' || strategy === 'squash') {
  //     await client.squashMerge(
  //       targets[0].repositoryName!,
  //       targets[0].sourceReference!,
  //       targets[0].destinationReference!,
  //       pReq?.title
  //     );
  //   } else if (strategy === 'fast-forward') {
  //     await client.fastForwardMerge(
  //       targets[0].repositoryName!,
  //       targets[0].sourceReference!,
  //       targets[0].destinationReference!
  //     );
  //   } else {
  //     logger.debug(`unsupported strategy`);
  //     return false;
  //   }
  // } catch (err) {
  //   logger.debug({ err }, `PR merge error`);
  //   logger.info({ pr: prNo }, 'PR automerge failed');
  //   return false;
  // }
  //
  // logger.trace(`Updating PR ${prNo} to status ${PullRequestStatusEnum.CLOSED}`);
  //
  // try {
  //   const response = await client.updatePrStatus(
  //     `${prNo}`,
  //     PullRequestStatusEnum.CLOSED
  //   );
  //   const isClosed =
  //     response.pullRequest?.pullRequestStatus === PullRequestStatusEnum.CLOSED;
  //
  //   if (!isClosed) {
  //     logger.warn(
  //       {
  //         pullRequestId: prNo,
  //         status: response.pullRequest?.pullRequestStatus,
  //       },
  //       `Expected PR to have status`
  //     );
  //   }
  //   return true;
  // } catch (err) {
  //   logger.debug({ err }, 'Failed to set the PR as Closed.');
  //   return false;
  // }
}

export async function addReviewers(
  prNo: number,
  reviewers: string[],
): Promise<void> {
  const numberOfApprovers = reviewers.length;
  const approvalRuleContents = `{"Version":"2018-11-08","Statements": [{"Type": "Approvers","NumberOfApprovalsNeeded":${numberOfApprovers},"ApprovalPoolMembers": ${JSON.stringify(
    reviewers,
  )}}]}`;
  const res = await client.createPrApprovalRule(
    `${prNo}`,
    approvalRuleContents,
  );
  if (res) {
    const approvalRule = res.approvalRule;
    logger.debug({ approvalRule }, `Approval Rule Added to PR #${prNo}:`);
  }
}

/* istanbul ignore next */
export function addAssignees(iid: number, assignees: string[]): Promise<void> {
  // CodeCommit does not support adding reviewers
  return Promise.resolve();
}

/* istanbul ignore next */
export function findIssue(title: string): Promise<Issue | null> {
  // CodeCommit does not have issues
  return Promise.resolve(null);
}

/* istanbul ignore next */
export function ensureIssue({
  title,
}: EnsureIssueConfig): Promise<EnsureIssueResult | null> {
  // CodeCommit does not have issues
  return Promise.resolve(null);
}

/* istanbul ignore next */
export function getIssueList(): Promise<Issue[]> {
  // CodeCommit does not have issues
  return Promise.resolve([]);
}

/* istanbul ignore next */
export function ensureIssueClosing(title: string): Promise<void> {
  // CodeCommit does not have issues
  return Promise.resolve();
}

/* istanbul ignore next */
export function deleteLabel(prNumber: number, label: string): Promise<void> {
  return Promise.resolve();
}

// Returns the combined status for a branch.
/* istanbul ignore next */
export function getBranchStatus(branchName: string): Promise<BranchStatus> {
  logger.debug(`getBranchStatus(${branchName})`);
  logger.debug(
    'returning branch status yellow, because getBranchStatus isnt supported on aws yet',
  );
  return Promise.resolve('yellow');
}

/* istanbul ignore next */
export function getBranchStatusCheck(
  branchName: string,
  context: string,
): Promise<BranchStatus | null> {
  logger.debug(`getBranchStatusCheck(${branchName}, context=${context})`);
  logger.debug(
    'returning null, because getBranchStatusCheck is not supported on aws yet',
  );
  return Promise.resolve(null);
}

/* istanbul ignore next */
export function setBranchStatus({
  branchName,
  context,
  description,
  state,
  url: targetUrl,
}: BranchStatusConfig): Promise<void> {
  return Promise.resolve();
}

export async function ensureComment({
  number,
  topic,
  content,
}: EnsureCommentConfig): Promise<boolean> {
  logger.debug(`ensureComment(${number}, ${topic!}, content)`);
  const header = topic ? `### ${topic}\n\n` : '';
  const body = `${header}${sanitize(content)}`;
  let prCommentsResponse: GetCommentsForPullRequestOutput;
  try {
    prCommentsResponse = await client.getPrComments(`${number}`);
  } catch (err) {
    logger.debug({ err }, 'Unable to retrieve pr comments');
    return false;
  }

  let commentId: string | undefined = undefined;
  let commentNeedsUpdating = false;

  if (!prCommentsResponse?.commentsForPullRequestData) {
    return false;
  }

  for (const commentObj of prCommentsResponse.commentsForPullRequestData) {
    if (!commentObj?.comments) {
      continue;
    }
    const firstCommentContent = commentObj.comments[0].content;
    if (
      (topic && firstCommentContent?.startsWith(header)) === true ||
      (!topic && firstCommentContent === body)
    ) {
      commentId = commentObj.comments[0].commentId;
      commentNeedsUpdating = firstCommentContent !== body;
      break;
    }
  }

  if (!commentId) {
    const prs = await getPrList();
    const thisPr = prs.filter((item) => item.number === number);

    if (!thisPr[0].sourceCommit || !thisPr[0].destinationCommit) {
      return false;
    }

    await client.createPrComment(
      `${number}`,
      config.repository,
      body,
      thisPr[0].destinationCommit,
      thisPr[0].sourceCommit,
    );
    logger.info(
      { repository: config.repository, prNo: number, topic },
      'Comment added',
    );
  } else if (commentNeedsUpdating && commentId) {
    await client.updateComment(commentId, body);

    logger.debug(
      { repository: config.repository, prNo: number, topic },
      'Comment updated',
    );
  } else {
    logger.debug(
      { repository: config.repository, prNo: number, topic },
      'Comment is already update-to-date',
    );
  }

  return true;
}

export async function ensureCommentRemoval(
  removeConfig: EnsureCommentRemovalConfig,
): Promise<void> {
  const { number: prNo } = removeConfig;
  const key =
    removeConfig.type === 'by-topic'
      ? removeConfig.topic
      : removeConfig.content;
  logger.debug(`Ensuring comment "${key}" in #${prNo} is removed`);

  let prCommentsResponse: GetCommentsForPullRequestOutput;
  try {
    prCommentsResponse = await client.getPrComments(`${prNo}`);
  } catch (err) {
    logger.debug({ err }, 'Unable to retrieve pr comments');
    return;
  }

  if (!prCommentsResponse?.commentsForPullRequestData) {
    logger.debug('commentsForPullRequestData not found');
    return;
  }

  let commentIdToRemove: string | undefined;
  for (const commentObj of prCommentsResponse.commentsForPullRequestData) {
    if (!commentObj?.comments) {
      logger.debug(
        'comments object not found under commentsForPullRequestData',
      );
      continue;
    }

    for (const comment of commentObj.comments) {
      if (
        (removeConfig.type === 'by-topic' &&
          comment.content?.startsWith(`### ${removeConfig.topic}\n\n`)) ===
          true ||
        (removeConfig.type === 'by-content' &&
          removeConfig.content === comment.content?.trim())
      ) {
        commentIdToRemove = comment.commentId;
        break;
      }
    }
    if (commentIdToRemove) {
      await client.deleteComment(commentIdToRemove);
      logger.debug(`comment "${key}" in PR #${prNo} was removed`);
      break;
    }
  }
}
