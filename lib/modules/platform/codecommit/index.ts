import {
  CodeCommitClient,
  CreatePullRequestCommand,
  CreatePullRequestInput,
  CreatePullRequestOutput,
  GetFileCommand,
  GetFileInput,
  GetFileOutput,
  GetPullRequestCommand,
  GetPullRequestInput,
  GetPullRequestOutput,
  GetRepositoryCommand,
  GetRepositoryInput,
  GetRepositoryOutput,
  ListPullRequestsCommand,
  ListPullRequestsInput,
  ListPullRequestsOutput,
  ListRepositoriesCommand,
  ListRepositoriesInput,
  ListRepositoriesOutput,
  MergeBranchesByFastForwardCommand,
  MergeBranchesByFastForwardInput,
  MergeBranchesBySquashCommand,
  MergeBranchesBySquashInput,
  PullRequestStatusEnum,
  UpdatePullRequestDescriptionCommand,
  UpdatePullRequestDescriptionInput,
  UpdatePullRequestStatusCommand,
  UpdatePullRequestStatusInput,
  UpdatePullRequestTitleCommand,
  UpdatePullRequestTitleInput,
} from '@aws-sdk/client-codecommit';
import type { Credentials } from '@aws-sdk/types';

import JSON5 from 'json5';
import {
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
import { getCodeCommitUrl, getNewBranchName } from './util';

const decoder = new TextDecoder();

// todo check what is this for
// const defaults = {
//   hostType: PlatformId.CodeCommit
// };
let codeCommitClient: CodeCommitClient;
let credentials: Credentials;

//todo renove extras in config
interface Config {
  repoForceRebase?: boolean;
  repoId?: string;
  arn?: string;
  fileList?: null;
  repository?: string;
  defaultBranch?: string;
  region?: string;
  prList?: Pr[];
}

const config: Config = {};

export function initPlatform({
  endpoint,
  username,
  password,
  gitAuthor,
}: PlatformParams): Promise<PlatformResult> {
  let accessKeyId = username;
  let secretAccessKey = password;
  let region;

  if (!gitAuthor) {
    throw new Error('Init: You must configure a git username');
  }

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
      logger.warn('cant parse region, check your endpoint');
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
  credentials = {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
  };

  codeCommitClient = new CodeCommitClient({
    region: region,
    credentials: credentials,
  });

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

  const url = getCodeCommitUrl(config.region!, repository, credentials);
  await git.initRepo({
    ...config,
    url,
  });

  //todo this code could be GetRepoByName function
  const getRepositoryInput: GetRepositoryInput = {
    repositoryName: `${repository}`,
  };
  let repo: GetRepositoryOutput;
  const getRepoCmd = new GetRepositoryCommand(getRepositoryInput);
  try {
    repo = await codeCommitClient.send(getRepoCmd);
  } catch (error) {
    logger.error({ repository }, 'Could not find repository');
    throw new Error(REPOSITORY_NOT_FOUND);
  }

  // TODO:do we need this check?
  // istanbul ignore if
  if (!repo) {
    logger.error({ repository }, 'Could not find repository');
    throw new Error(REPOSITORY_NOT_FOUND);
  }

  logger.debug({ repositoryDetails: repo }, 'Repository details');
  const metadata = repo.repositoryMetadata;
  // istanbul ignore if
  if (!metadata || !metadata.defaultBranch) {
    logger.debug('Repo is empty');
    throw new Error(REPOSITORY_EMPTY);
  }

  config.repoId = metadata.repositoryId;
  config.arn = metadata.Arn;

  const defaultBranch = metadata.defaultBranch;
  config.defaultBranch = defaultBranch;
  logger.debug(`${repository} default branch = ${defaultBranch}`);

  config.repoForceRebase = false;

  return {
    defaultBranch,
    isFork: false,
  };
}

export async function getPrList(): Promise<Pr[]> {
  logger.debug('getPrList()');

  const input: ListPullRequestsInput = {
    repositoryName: config.repository,
    pullRequestStatus: PullRequestStatusEnum.OPEN,
  };
  const cmd = new ListPullRequestsCommand(input);
  const listPrIdsRes: ListPullRequestsOutput = await codeCommitClient.send(cmd);

  const prIds = listPrIdsRes.pullRequestIds ?? [];
  const fetchedPrs: Pr[] = [];
  for (const prId of prIds) {
    const prRes = await getPrCodeCommit(prId);
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
  const res = existingPr ? getPr(existingPr.number) : null;
  // if (!res) {
  //   const getBranchInput: GetBranchInput = {
  //     branchName: branchName,
  //     repositoryName: config.repository
  //   }
  //
  //   const getBranchCmd = new GetBranchCommand(getBranchInput);
  //   const data = await codeCommitClient.send(getBranchCmd);
  //   if(!data.branch) {
  //     const getBranchDefault: GetBranchInput = {
  //       branchName: config.defaultBranch,
  //       repositoryName: config.repository
  //     }
  //
  //     const branchDefaultCmd = new GetBranchCommand(getBranchDefault);
  //     const defaultBranch = await codeCommitClient.send(branchDefaultCmd);
  //     // create branch
  //     const branchInput: CreateBranchInput = {
  //       branchName: branchName,
  //       repositoryName: config.repository,
  //       commitId: defaultBranch.branch?.commitId,
  //     }
  //
  //     const createBranch = new CreateBranchCommand(branchInput);
  //     await codeCommitClient.send(createBranch);
  //   }
  // }
  return res;
}

export async function getPr(pullRequestId: number): Promise<Pr | null> {
  logger.debug(`getPr(${pullRequestId})`);
  if (!pullRequestId) {
    return null;
  }

  const prRes = await getPrCodeCommit(`${pullRequestId}`);
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

  const listRepoInput: ListRepositoriesInput = {};
  const listReposCmd = new ListRepositoriesCommand(listRepoInput);
  let reposRes: ListRepositoriesOutput;
  try {
    reposRes = await codeCommitClient.send(listReposCmd);
    //todo do we need pagination? whats the maximum number of repositories that returns?
  } catch (error) {
    logger.error({ error }, 'Could not retrieve repositories');
    return [];
    //todo do we throw error here?
  }

  return reposRes.repositories!.map((repo) => `${repo.repositoryName}`);
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
      regEx(/<!--renovate-debug:(?<payload>.*?)-->/),
      `[//]: # (<payload>)`
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
  const fileInput: GetFileInput = {
    repositoryName: repoName,
    filePath: fileName,
    commitSpecifier: branchOrTag,
  };
  const fileCmd: GetFileCommand = new GetFileCommand(fileInput);
  let fileRes: GetFileOutput;
  try {
    fileRes = await codeCommitClient.send(fileCmd);
  } catch (error) {
    logger.error({ error }, 'Could not retrieve file');
    return null;
  }
  return decoder.decode(fileRes.fileContent);
}

export function getRepoForceRebase(): Promise<boolean> {
  return Promise.resolve(config.repoForceRebase === true);
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

  const createPrInput: CreatePullRequestInput = {
    title: title,
    description: sanitize(description),
    targets: [
      {
        sourceReference: sourceRefName,
        destinationReference: targetRefName,
        repositoryName: config.repository,
      },
    ],
  };
  const prCmd = new CreatePullRequestCommand(createPrInput);

  const prCreateRes: CreatePullRequestOutput = await codeCommitClient.send(
    prCmd
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
    const updateDescInput: UpdatePullRequestDescriptionInput = {
      pullRequestId: `${prNo}`,
      description: smartTruncate(sanitize(body), 10239),
    };
    const prDescCmd = new UpdatePullRequestDescriptionCommand(updateDescInput);
    await codeCommitClient.send(prDescCmd);
  }

  if (title) {
    const updateTitleInput: UpdatePullRequestTitleInput = {
      pullRequestId: `${prNo}`,
      title: title,
    };
    const updateTitleCmd = new UpdatePullRequestTitleCommand(updateTitleInput);
    await codeCommitClient.send(updateTitleCmd);
  }

  const updateStateInput: UpdatePullRequestStatusInput = {
    pullRequestId: `${prNo}`,
    pullRequestStatus: PullRequestStatusEnum.OPEN,
  };

  if (state === PrState.Closed) {
    updateStateInput.pullRequestStatus = PullRequestStatusEnum.CLOSED;
  }

  const updateStateCmd = new UpdatePullRequestStatusCommand(updateStateInput);
  try {
    await codeCommitClient.send(updateStateCmd);
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

  const prOut = await getPrCodeCommit(`${pullRequestId}`);
  if (!prOut) {
    return false;
  }
  const pReq = prOut.pullRequest;
  const targets = pReq?.pullRequestTargets;

  if (!targets) {
    return false;
  }

  if (strategy === 'auto' || strategy === 'squash') {
    const squashInput: MergeBranchesBySquashInput = {
      repositoryName: targets[0].repositoryName,
      sourceCommitSpecifier: targets[0].sourceReference,
      destinationCommitSpecifier: targets[0].destinationReference,
      commitMessage: pReq?.title,
      targetBranch: targets[0].destinationReference,
    };
    const squashCmd = new MergeBranchesBySquashCommand(squashInput);
    await codeCommitClient.send(squashCmd);
  } else if (strategy === 'fast-forward') {
    const squashInput: MergeBranchesByFastForwardInput = {
      repositoryName: targets[0].repositoryName,
      sourceCommitSpecifier: targets[0].sourceReference,
      destinationCommitSpecifier: targets[0].destinationReference,
      targetBranch: targets[0].destinationReference,
    };
    const squashCmd = new MergeBranchesByFastForwardCommand(squashInput);
    await codeCommitClient.send(squashCmd);
  } else {
    logger.debug(`unsupported strategy`);
    return false;
  }

  logger.trace(
    `Updating PR ${pullRequestId} to status ${PullRequestStatusEnum.CLOSED}`
  );

  const updateStateInput: UpdatePullRequestStatusInput = {
    pullRequestId: `${pullRequestId}`,
    pullRequestStatus: PullRequestStatusEnum.CLOSED,
  };

  const updateStateCmd = new UpdatePullRequestStatusCommand(updateStateInput);

  try {
    const response = await codeCommitClient.send(updateStateCmd);

    // let retries = 0;
    const isClosed =
      response.pullRequest?.pullRequestStatus === PullRequestStatusEnum.CLOSED;
    // while (!isClosed && retries < 5) {
    //   retries += 1;
    //   const sleepMs = retries * 1000;
    //   logger.trace(
    //     {pullRequestId, status: pr.status, retries},
    //     `Updated PR to closed status but change has not taken effect yet. Retrying...`
    //   );
    //
    //   await delay(sleepMs);
    //   pr = await azureApiGit.getPullRequestById(pullRequestId, config.project);
    //   isClosed = pr.status === PullRequestStatus.Completed;
    // }

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

async function getPrCodeCommit(
  prId: string
): Promise<GetPullRequestOutput | undefined> {
  const prInput: GetPullRequestInput = {
    pullRequestId: prId,
  };
  const cmdPr = new GetPullRequestCommand(prInput);
  let res = undefined;
  try {
    res = await codeCommitClient.send(cmdPr);
  } catch (err) {
    logger.debug({ err }, 'failed to get PR using prId');
  }
  return res;
}

//   addAssignees,xxx
//   addReviewers,xxx

//   ensureIssue, xxx
//   ensureIssueClosing,xxx
//   findIssue,xxx
//   getIssue,xxx
//   getIssueList,xxx
//   initRepo,
//   getPrList,
//   findPr,
//   getBranchPr,
//   getPr,
//   initPlatform,
//   getRepos
//   massageMarkdown,
//   getRepoForceRebase,
//   getRawFile,
//   getJsonFile,
//   getVulnerabilityAlerts, xxxxxxxxxxxxxxxxxx
//   getBranchStatus,      ?????????????????????
//   getBranchStatusCheck, ?????????????????????
//   setBranchStatus,      ?????????????????????
//   deleteLabel,          what's this for???
//   ensureComment,        what do we use this for
//   ensureCommentRemoval, what do we use this for
//   createPr,
//   updatePr,
//   mergePr, in progress

// Issue

/* istanbul ignore next */
export function findIssue(title: string): Promise<Issue | null> {
  logger.debug(`findIssue(${title})`);
  // This is used by Renovate when creating its own issues,
  // e.g. for deprecated package warnings,
  // config error notifications, or "dependencyDashboard"
  //
  // CodeCommit Server does not have issues
  return Promise.resolve(null);
}

/* istanbul ignore next */
export function ensureIssue({
  title,
}: EnsureIssueConfig): Promise<EnsureIssueResult | null> {
  logger.warn({ title }, 'Cannot ensure issue');
  // This is used by Renovate when creating its own issues,
  // e.g. for deprecated package warnings,
  // config error notifications, or "dependencyDashboard"
  //
  // CodeCommit Server does not have issues
  return Promise.resolve(null);
}

/* istanbul ignore next */
export function getIssueList(): Promise<Issue[]> {
  logger.debug(`getIssueList()`);
  // This is used by Renovate when creating its own issues,
  // e.g. for deprecated package warnings,
  // config error notifications, or "dependencyDashboard"
  //
  // CodeCommit Server does not have issues
  return Promise.resolve([]);
}

/* istanbul ignore next */
export function ensureIssueClosing(title: string): Promise<void> {
  logger.debug(`ensureIssueClosing(${title})`);
  // This is used by Renovate when creating its own issues,
  // e.g. for deprecated package warnings,
  // config error notifications, or "dependencyDashboard"
  //
  // CodeCommit Server does not have issues
  return Promise.resolve();
}

export function addAssignees(iid: number, assignees: string[]): Promise<void> {
  logger.debug(`addAssignees(${iid}, [${assignees.join(', ')}])`);
  // This is used by Renovate when creating its own issues,
  // e.g. for deprecated package warnings,
  // config error notifications, or "dependencyDashboard"
  //
  // CodeCommit Server does not have issues
  return Promise.resolve();
}

export function addReviewers(prNo: number, reviewers: string[]): Promise<void> {
  return Promise.resolve();
}

export function deleteLabel(prNumber: number, label: string): Promise<void> {
  return Promise.resolve();
}

export function getVulnerabilityAlerts(): Promise<VulnerabilityAlert[]> {
  return Promise.resolve([]);
}

// Returns the combined status for a branch.
export async function getBranchStatus(
  branchName: string
): Promise<BranchStatus> {
  //todo delete this
  logger.debug(`getBranchStatus(${branchName})`);
  await getPrCodeCommit(branchName);
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

// export async function commitFiles({
//                                     branchName,
//                                     files,
//                                     message,
//                                     force,
//                                     platformCommit,
//                                   }: CommitFilesConfig): Promise<CommitSha | null> {
//
//   // take last commit
//   const getBranchInput: GetBranchInput = {
//     branchName: config.defaultBranch,
//     repositoryName: config.repository
//   }
//
//   const getBranchMain = new GetBranchCommand(getBranchInput);
//   const data = await codeCommitClient.send(getBranchMain);
//   const commitId = data.branch?.commitId;
//
//
//   // create branch
//   const branchInput: CreateBranchInput = {
//     branchName: branchName,
//     repositoryName: config.repository,
//     commitId: commitId
//   }
//
//   const createBranch = new CreateBranchCommand(branchInput);
//   await codeCommitClient.send(createBranch);
//   // get created branch commit
//   const getNewBranchInput:GetBranchInput = {
//     branchName:branchName,
//     repositoryName: config.repository,
//   };
//
//   const newBranchCmd = new GetBranchCommand(getNewBranchInput);
//   const newBranchData = await codeCommitClient.send(newBranchCmd);
//
//
//
//   // commit files
//   // const encoder = new TextEncoder();
//   // let convertedToUint8Array = encoder.encode('{\\n  \\"name\\": \\"renovate_tutorial\\",\\n  \\"version\\": \\"0.0.1\\",\\n  \\"description\\": \\"A simple package json for Renovate tutorial use only\\",\\n  \\"author\\": \\"Philip\\",\\n  \\"license\\": \\"Apache-2.0\\",\\n  \\"dependencies\\": {\\n    \\"commander\\": \\"2.20.3\\",\\n    \\"lodash\\": \\"4.16.0\\",\\n\\t\\"six\\": \\"0.0.6\\",\\n    \\"@date-io/date-fns\\": \\"2.10.0\\",\\n    \\"@date-io/moment\\": \\"2.10.0\\"\\n  }\\n}\\n');
//    const commitInput: CreateCommitInput = {
//     repositoryName: 'RenovateTest1',
//     branchName: 'firstBranch',
//     commitMessage: 'this is my first commit',
//     authorName: 'Stinky',
//     parentCommitId: newBranchData.branch?.commitId,
//     putFiles: [{
//       filePath: 'C:\\tests\\newProject\\package.json',
//       fileMode: 'NORMAL',
//     }],
//   }
//   let createCommit = new CreateCommitCommand(commitInput);
//
//     const data = await client.send(createCommit);
//
//
//
//   return commitSha;
// }
