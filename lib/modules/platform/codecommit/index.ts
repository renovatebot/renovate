import { PullRequestStatusEnum } from '@aws-sdk/client-codecommit';
import type { Credentials } from '@aws-sdk/types';
import JSON5 from 'json5';
import {
  PLATFORM_BAD_CREDENTIALS,
  REPOSITORY_EMPTY,
  REPOSITORY_NOT_FOUND,
} from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { BranchStatus, PrState, VulnerabilityAlert } from '../../../types';
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
import { smartTruncate } from '../utils/pr-body';
import * as client from './codecommit-client';
import { getCodeCommitUrl, getNewBranchName } from './util';

const decoder = new TextDecoder();

// todo check what is this for
// const defaults = {
//   hostType: PlatformId.CodeCommit
// };

interface Config {
  repository?: string;
  defaultBranch?: string;
  region?: string;
  prList?: Pr[];
  credentials?: Credentials;
}

const config: Config = {};

export function initPlatform({
  endpoint,
  username,
  password,
}: PlatformParams): Promise<PlatformResult> {
  let accessKeyId = username;
  let secretAccessKey = password;
  let region;

  if (!accessKeyId) {
    accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  }
  if (!secretAccessKey) {
    secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  }
  if (endpoint) {
    const regionReg = regEx(/.*codecommit\.(?<region>.+)\.amazonaws\.com/);
    const codeCommitMatch = regionReg.exec(endpoint);
    region = codeCommitMatch?.groups?.region;
    if (!region) {
      logger.warn("Can't parse region, make sure your endpoint is correct");
    }
  } else {
    region = process.env.AWS_REGION;
  }

  if (!accessKeyId || !secretAccessKey || !region) {
    throw new Error(
      'Init: You must configure a AWS user(accessKeyId), password(secretAccessKey) and endpoint/AWS_REGION'
    );
  }
  config.region = region;
  const credentials = {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
  };
  config.credentials = credentials;

  client.buildCodeCommitClient(region, credentials);

  const platformConfig: PlatformResult = {
    endpoint: region,
    token: secretAccessKey,
    renovateUsername: accessKeyId,
  };
  return Promise.resolve(platformConfig);
}

export async function initRepo({
  repository,
}: RepoParams): Promise<RepoResult> {
  logger.debug(`initRepo("${repository}")`);

  config.repository = repository;

  const url = getCodeCommitUrl(config.region!, repository, config.credentials!);
  try {
    await git.initRepo({
      ...config,
      url,
    });
  } catch (err) {
    throw new Error(PLATFORM_BAD_CREDENTIALS);
  }

  let repo;
  try {
    repo = await client.getRepositoryInfo(repository);
  } catch (error) {
    logger.error({ repository }, 'Could not find repository');
    throw new Error(REPOSITORY_NOT_FOUND);
  }

  if (!repo) {
    logger.error({ repository }, 'Could not find repository');
    throw new Error(REPOSITORY_NOT_FOUND);
  }

  logger.debug({ repositoryDetails: repo }, 'Repository details');
  const metadata = repo.repositoryMetadata;

  if (!metadata || !metadata.defaultBranch) {
    logger.debug('Repo is empty');
    throw new Error(REPOSITORY_EMPTY);
  }

  const defaultBranch = metadata.defaultBranch;
  config.defaultBranch = defaultBranch;
  logger.debug(`${repository} default branch = ${defaultBranch}`);

  return {
    defaultBranch,
    isFork: false,
  };
}

export async function getPrList(): Promise<Pr[]> {
  logger.debug('getPrList()');

  const listPrsResponse = await client.listPullRequests(config.repository!);

  const prIds = listPrsResponse.pullRequestIds ?? [];
  const fetchedPrs: Pr[] = [];
  for (const prId of prIds) {
    const prRes = await client.getPr(prId);
    if (!prRes || !prRes.pullRequest) {
      continue;
    }
    const prInfo = prRes.pullRequest;
    const pr: Pr = {
      targetBranch: prInfo.pullRequestTargets![0].destinationReference!,
      sourceBranch: prInfo.pullRequestTargets![0].sourceReference!,
      state: prInfo.pullRequestStatus!,
      number: Number(prId),
      title: prInfo.title!,
    };
    fetchedPrs.push(pr);
  }

  config.prList = fetchedPrs;

  logger.debug({ length: fetchedPrs.length }, 'Retrieved Pull Requests');
  return fetchedPrs;
}

export async function findPr({
  branchName,
  prTitle,
  state = PrState.All,
}: FindPRConfig): Promise<Pr | null> {
  let prsFiltered: Pr[] = [];
  try {
    const prs = await getPrList();
    const refsHeadBranchName = getNewBranchName(branchName);
    prsFiltered = prs.filter(
      (item) => item.sourceBranch === refsHeadBranchName
    ); //todo sourcebranch refs/heads/name while branch name is simple name

    if (prTitle) {
      prsFiltered = prsFiltered.filter((item) => item.title === prTitle);
    }

    switch (state) {
      case PrState.All:
        // no more filter needed, we can go further...
        break;
      case PrState.NotOpen:
        prsFiltered = prsFiltered.filter(
          (item) => item.state !== PullRequestStatusEnum.OPEN
        );
        break;
      default:
        prsFiltered = prsFiltered.filter(
          (item) => item.state === PullRequestStatusEnum.OPEN
        );
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

export async function getBranchPr(branchName: string): Promise<Pr | null> {
  logger.debug(`getBranchPr(${branchName})`);
  const existingPr = await findPr({
    branchName,
    state: PrState.Open,
  });
  return existingPr ? getPr(existingPr.number) : null;
}

export async function getPr(pullRequestId: number): Promise<Pr | null> {
  logger.debug(`getPr(${pullRequestId})`);
  if (!pullRequestId) {
    return null;
  }

  const prRes = await client.getPr(`${pullRequestId}`);
  if (!prRes || !prRes.pullRequest) {
    return null;
  }
  const prInfo = prRes.pullRequest;
  return {
    sourceBranch: prInfo.pullRequestTargets![0].sourceReference!,
    state: prInfo.pullRequestStatus!,
    number: Number(pullRequestId),
    title: prInfo.title!,
  };
}

export async function getRepos(): Promise<string[]> {
  logger.debug('Autodiscovering AWS CodeCommit repositories');

  let reposRes;
  try {
    reposRes = await client.listRepositories();
    //todo ask if we need pagination? maximum number of repos is 1000 without pagination.
  } catch (error) {
    logger.error({ error }, 'Could not retrieve repositories');
    return [];
  }
  if (!reposRes.repositories) {
    return [];
  }
  const res: string[] = [];
  for (const repo of reposRes.repositories) {
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
      'rename PR to start with "rebase!"'
    )
    .replace(regEx(/<\/?summary>/g), '**')
    .replace(regEx(/<\/?details>/g), '')
    .replace(regEx(`\n---\n\n.*?<!-- rebase-check -->.*?\n`), '')
    .replace(regEx(/\]\(\.\.\/pull\//g), '](../../pull-requests/')
    .replace(
      regEx(/(?<hiddenComment><!--renovate-debug:.*?-->)/),
      '[//]: # ($<hiddenComment>)'
    );
}

export async function getJsonFile(
  fileName: string,
  repoName?: string,
  branchOrTag?: string
): Promise<any | null> {
  const raw = await getRawFile(fileName, repoName, branchOrTag);
  if (!raw) {
    return null;
  }
  return JSON5.parse(raw);
}

export async function getRawFile(
  fileName: string,
  repoName?: string,
  branchOrTag?: string
): Promise<string | null> {
  let fileRes;
  try {
    fileRes = await client.getFile(
      repoName ?? config.repository,
      fileName,
      branchOrTag
    );
  } catch (error) {
    logger.error({ error }, 'Could not retrieve file');
    return null;
  }
  return decoder.decode(fileRes.fileContent);
}

export function getRepoForceRebase(): Promise<boolean> {
  return Promise.resolve(false);
}

export async function createPr({
  sourceBranch,
  targetBranch,
  prTitle: title,
  prBody: body,
}: CreatePRConfig): Promise<Pr> {
  const sourceRefName = sourceBranch;
  const targetRefName = targetBranch;
  const description = smartTruncate(sanitize(body), 10239);

  const prCreateRes = await client.createPr(
    title,
    sanitize(description),
    sourceRefName,
    targetRefName,
    config.repository
  );

  if (!prCreateRes.pullRequest?.pullRequestStatus) {
    throw new Error('Could not create pr, missing prStatus');
  }
  if (!prCreateRes.pullRequest?.title) {
    throw new Error('Could not create pr, missing prTitle');
  }
  return {
    createdAt: prCreateRes.pullRequest?.creationDate?.toLocaleString(),
    number: Number(prCreateRes.pullRequest?.pullRequestId),
    state: prCreateRes.pullRequest?.pullRequestStatus,
    title: prCreateRes.pullRequest?.title,
    sourceBranch: sourceBranch,
    targetBranch: targetBranch,
    sourceRepo: config.repository,
  };
}

export async function updatePr({
  number: prNo,
  prTitle: title,
  prBody: body,
  state,
}: UpdatePrConfig): Promise<void> {
  logger.debug(`updatePr(${prNo}, ${title}, body)`);

  if (body) {
    await client.updatePrDescription(
      `${prNo}`,
      smartTruncate(sanitize(body), 10239)
    );
  }

  if (title) {
    await client.updatePrTitle(`${prNo}`, title);
  }

  const prStatusInput =
    state === PrState.Closed
      ? PullRequestStatusEnum.CLOSED
      : PullRequestStatusEnum.OPEN;
  try {
    await client.updatePrStatus(`${prNo}`, prStatusInput);
  } catch (err) {
    // do nothing, it's ok to fail sometimes when trying to update from open to open or from closed to closed.
  }
}

export async function mergePr({
  branchName,
  id: pullRequestId,
  strategy,
}: MergePRConfig): Promise<boolean> {
  logger.debug(`mergePr(${pullRequestId}, ${branchName!})`);

  const prOut = await client.getPr(`${pullRequestId}`);
  if (!prOut) {
    return false;
  }
  const pReq = prOut.pullRequest;
  const targets = pReq?.pullRequestTargets;

  if (!targets) {
    return false;
  }

  if (strategy === 'auto' || strategy === 'squash') {
    await client.squashMerge(
      targets[0].repositoryName!,
      targets[0].sourceReference!,
      targets[0].destinationReference!,
      pReq?.title
    );
  } else if (strategy === 'fast-forward') {
    await client.fastForwardMerge(
      targets[0].repositoryName!,
      targets[0].sourceReference!,
      targets[0].destinationReference!
    );
  } else {
    logger.debug(`unsupported strategy`);
    return false;
  }

  logger.trace(
    `Updating PR ${pullRequestId} to status ${PullRequestStatusEnum.CLOSED}`
  );

  try {
    const response = await client.updatePrStatus(
      `${pullRequestId}`,
      PullRequestStatusEnum.CLOSED
    );
    const isClosed =
      response.pullRequest?.pullRequestStatus === PullRequestStatusEnum.CLOSED;

    if (!isClosed) {
      logger.warn(
        { pullRequestId, status: response.pullRequest?.pullRequestStatus },
        `Expected PR to have status`
      );
    }
    return true;
  } catch (err) {
    logger.debug({ err }, 'Failed to set the PR as Closed.');
    return false;
  }
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
export function addAssignees(iid: number, assignees: string[]): Promise<void> {
  // CodeCommit does not support adding assignees
  return Promise.resolve();
}

/* istanbul ignore next */
export function addReviewers(prNo: number, reviewers: string[]): Promise<void> {
  // CodeCommit does not support adding reviewers
  return Promise.resolve();
}

/* istanbul ignore next */
export function deleteLabel(prNumber: number, label: string): Promise<void> {
  return Promise.resolve();
}

/* istanbul ignore next */
export function getVulnerabilityAlerts(): Promise<VulnerabilityAlert[]> {
  return Promise.resolve([]);
}

// Returns the combined status for a branch.
export async function getBranchStatus(
  branchName: string
): Promise<BranchStatus> {
  //todo delete this
  logger.debug(`getBranchStatus(${branchName})`);
  await client.getPr(`1`);
  // logger.debug({ branch: branchName, statuses }, 'branch status check result');
  // if (!statuses.length) {
  //   logger.debug('empty branch status check result = returning "pending"');
  //   return BranchStatus.yellow;
  // }
  // const noOfFailures = statuses.filter(
  //   (status: { state: string }) =>
  //     status.state === 'FAILED' || status.state === 'STOPPED'
  // ).length;
  // if (noOfFailures) {
  //   return BranchStatus.red;
  // }
  // const noOfPending = statuses.filter(
  //   (status: { state: string }) => status.state === 'INPROGRESS'
  // ).length;
  // if (noOfPending) {
  //   return BranchStatus.yellow;
  // }
  return BranchStatus.green;
}

export function getBranchStatusCheck(
  branchName: string,
  context: string
): Promise<BranchStatus | null> {
  return Promise.resolve(null);
}

export function setBranchStatus({
  branchName,
  context,
  description,
  state,
  url: targetUrl,
}: BranchStatusConfig): Promise<void> {
  return Promise.resolve();
}

export function ensureComment({
  number,
  topic,
  content,
}: EnsureCommentConfig): Promise<boolean> {
  return Promise.resolve(true);
}

export function ensureCommentRemoval(
  deleteConfig: EnsureCommentRemovalConfig
): Promise<void> {
  return Promise.resolve();
}

//   addAssignees, not supported
//   addReviewers, not supported
//   ensureIssue, not supported
//   ensureIssueClosing,not supported
//   findIssue,not supported
//   getIssue,not supported
//   getIssueList,not supported
//   getVulnerabilityAlerts, not supported
//   getBranchStatus,      which flow is this?
//   getBranchStatusCheck, which flow is this?
//   setBranchStatus,      which flow is this?
//   deleteLabel,          what's this for??? we cant put labels on prs not supported
//   ensureComment,        which flow is this?
//   ensureCommentRemoval, which flow is this?
