import { setTimeout } from 'timers/promises';
import is from '@sindresorhus/is';
import {
  GitPullRequest,
  GitPullRequestCommentThread,
  GitPullRequestMergeStrategy,
  GitStatus,
  GitStatusState,
  GitVersionDescriptor,
  PullRequestStatus,
} from 'azure-devops-node-api/interfaces/GitInterfaces.js';
import JSON5 from 'json5';
import {
  REPOSITORY_ARCHIVED,
  REPOSITORY_EMPTY,
  REPOSITORY_NOT_FOUND,
} from '../../../constants/error-messages';
import { logger } from '../../../logger';
import type { BranchStatus } from '../../../types';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import * as git from '../../../util/git';
import * as hostRules from '../../../util/host-rules';
import { regEx } from '../../../util/regex';
import { sanitize } from '../../../util/sanitize';
import { streamToString } from '../../../util/streams';
import { ensureTrailingSlash } from '../../../util/url';
import type {
  BranchStatusConfig,
  CreatePRConfig,
  EnsureCommentConfig,
  EnsureCommentRemovalConfig,
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
import * as azureApi from './azure-got-wrapper';
import * as azureHelper from './azure-helper';
import { AzurePr, AzurePrVote } from './types';
import {
  getBranchNameWithoutRefsheadsPrefix,
  getGitStatusContextCombinedName,
  getGitStatusContextFromCombinedName,
  getRenovatePRFormat,
  getRepoByName,
  getStorageExtraCloneOpts,
  max4000Chars,
} from './util';

interface Config {
  repoForceRebase: boolean;
  mergeMethods: Record<string, GitPullRequestMergeStrategy>;
  owner: string;
  repoId: string;
  project: string;
  prList: AzurePr[];
  fileList: null;
  repository: string;
  defaultBranch: string;
}

interface User {
  id: string;
  name: string;
  isRequired: boolean;
}

let config: Config = {} as any;

const defaults: {
  endpoint?: string;
  hostType: string;
} = {
  hostType: 'azure',
};

export const id = 'azure';

export function initPlatform({
  endpoint,
  token,
  username,
  password,
}: PlatformParams): Promise<PlatformResult> {
  if (!endpoint) {
    throw new Error('Init: You must configure an Azure DevOps endpoint');
  }
  if (!token && !(username && password)) {
    throw new Error(
      'Init: You must configure an Azure DevOps token, or a username and password'
    );
  }
  // TODO: Add a connection check that endpoint/token combination are valid (#9593)
  const res = {
    endpoint: ensureTrailingSlash(endpoint),
  };
  defaults.endpoint = res.endpoint;
  azureApi.setEndpoint(res.endpoint);
  const platformConfig: PlatformResult = {
    endpoint: defaults.endpoint,
  };
  return Promise.resolve(platformConfig);
}

export async function getRepos(): Promise<string[]> {
  logger.debug('Autodiscovering Azure DevOps repositories');
  const azureApiGit = await azureApi.gitApi();
  const repos = await azureApiGit.getRepositories();
  return repos
    .filter((repo) => repo.isDisabled !== true)
    .map((repo) => `${repo.project?.name}/${repo.name}`);
}

export async function getRawFile(
  fileName: string,
  repoName?: string,
  branchOrTag?: string
): Promise<string | null> {
  try {
    const azureApiGit = await azureApi.gitApi();

    let repoId: string | undefined;
    if (repoName) {
      const repos = await azureApiGit.getRepositories();
      const repo = getRepoByName(repoName, repos);
      repoId = repo?.id;
    } else {
      repoId = config.repoId;
    }

    if (!repoId) {
      logger.debug('No repoId so cannot getRawFile');
      return null;
    }

    const versionDescriptor: GitVersionDescriptor = {
      version: branchOrTag,
    } satisfies GitVersionDescriptor;

    const buf = await azureApiGit.getItemContent(
      repoId,
      fileName,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      branchOrTag ? versionDescriptor : undefined
    );

    const str = await streamToString(buf);
    return str;
  } catch (err) /* istanbul ignore next */ {
    if (
      err.message?.includes('<title>Azure DevOps Services Unavailable</title>')
    ) {
      logger.debug(
        'Azure DevOps is currently unavailable when attempting to fetch file - throwing ExternalHostError'
      );
      throw new ExternalHostError(err, id);
    }
    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
      throw new ExternalHostError(err, id);
    }
    if (err.statusCode && err.statusCode >= 500 && err.statusCode < 600) {
      throw new ExternalHostError(err, id);
    }
    throw err;
  }
}

export async function getJsonFile(
  fileName: string,
  repoName?: string,
  branchOrTag?: string
): Promise<any> {
  const raw = await getRawFile(fileName, repoName, branchOrTag);
  return raw ? JSON5.parse(raw) : null;
}

export async function initRepo({
  repository,
  cloneSubmodules,
}: RepoParams): Promise<RepoResult> {
  logger.debug(`initRepo("${repository}")`);
  config = { repository } as Config;
  const azureApiGit = await azureApi.gitApi();
  const repos = await azureApiGit.getRepositories();
  const repo = getRepoByName(repository, repos);
  if (!repo) {
    logger.error({ repos, repo }, 'Could not find repo in repo list');
    throw new Error(REPOSITORY_NOT_FOUND);
  }
  logger.debug({ repositoryDetails: repo }, 'Repository details');
  if (repo.isDisabled) {
    logger.debug('Repository is disabled- throwing error to abort renovation');
    throw new Error(REPOSITORY_ARCHIVED);
  }
  // istanbul ignore if
  if (!repo.defaultBranch) {
    logger.debug('Repo is empty');
    throw new Error(REPOSITORY_EMPTY);
  }
  // TODO #22198
  config.repoId = repo.id!;

  config.project = repo.project!.name!;
  config.owner = '?owner?';
  logger.debug(`${repository} owner = ${config.owner}`);
  const defaultBranch = repo.defaultBranch.replace('refs/heads/', '');
  config.defaultBranch = defaultBranch;
  logger.debug(`${repository} default branch = ${defaultBranch}`);
  config.mergeMethods = {};
  config.repoForceRebase = false;

  const [projectName, repoName] = repository.split('/');
  const opts = hostRules.find({
    hostType: defaults.hostType,
    url: defaults.endpoint,
  });
  // TODO: types (#22198)
  const manualUrl = `${defaults.endpoint!}${encodeURIComponent(
    projectName
  )}/_git/${encodeURIComponent(repoName)}`;
  const url = repo.remoteUrl ?? manualUrl;
  await git.initRepo({
    ...config,
    url,
    extraCloneOpts: getStorageExtraCloneOpts(opts),
    cloneSubmodules,
  });
  const repoConfig: RepoResult = {
    defaultBranch,
    isFork: false,
    repoFingerprint: repoFingerprint(repo.id!, defaults.endpoint),
  };
  return repoConfig;
}

export function getRepoForceRebase(): Promise<boolean> {
  return Promise.resolve(config.repoForceRebase === true);
}

export async function getPrList(): Promise<AzurePr[]> {
  logger.debug('getPrList()');
  if (!config.prList) {
    const azureApiGit = await azureApi.gitApi();
    let prs: GitPullRequest[] = [];
    let fetchedPrs: GitPullRequest[];
    let skip = 0;
    do {
      fetchedPrs = await azureApiGit.getPullRequests(
        config.repoId,
        { status: 4 },
        config.project,
        0,
        skip,
        100
      );
      prs = prs.concat(fetchedPrs);
      skip += 100;
    } while (fetchedPrs.length > 0);

    config.prList = prs.map(getRenovatePRFormat);
    logger.debug(`Retrieved Pull Requests count: ${config.prList.length}`);
  }
  return config.prList;
}

export async function getPr(pullRequestId: number): Promise<Pr | null> {
  logger.debug(`getPr(${pullRequestId})`);
  if (!pullRequestId) {
    return null;
  }
  const azurePr = (await getPrList()).find(
    (item) => item.number === pullRequestId
  );

  if (!azurePr) {
    return null;
  }

  const azureApiGit = await azureApi.gitApi();
  const labels = await azureApiGit.getPullRequestLabels(
    config.repoId,
    pullRequestId
  );

  azurePr.labels = labels
    .filter((label) => label.active)
    .map((label) => label.name)
    .filter(is.string);
  return azurePr;
}

export async function findPr({
  branchName,
  prTitle,
  state = 'all',
  targetBranch,
}: FindPRConfig): Promise<Pr | null> {
  let prsFiltered: Pr[] = [];
  try {
    const prs = await getPrList();

    prsFiltered = prs.filter(
      (item) => item.sourceRefName === getNewBranchName(branchName)
    );

    if (prTitle) {
      prsFiltered = prsFiltered.filter(
        (item) => item.title.toUpperCase() === prTitle.toUpperCase()
      );
    }

    switch (state) {
      case 'all':
        // no more filter needed, we can go further...
        break;
      case '!open':
        prsFiltered = prsFiltered.filter((item) => item.state !== 'open');
        break;
      default:
        prsFiltered = prsFiltered.filter((item) => item.state === state);
        break;
    }
  } catch (err) {
    logger.error({ err }, 'findPr error');
  }
  if (prsFiltered.length === 0) {
    return null;
  }
  if (targetBranch && prsFiltered.length > 1) {
    const pr = prsFiltered.find((item) => item.targetBranch === targetBranch);
    if (pr) {
      return pr;
    }
  }
  return prsFiltered[0];
}

export async function getBranchPr(
  branchName: string,
  targetBranch?: string
): Promise<Pr | null> {
  logger.debug(`getBranchPr(${branchName}, ${targetBranch})`);
  const existingPr = await findPr({
    branchName,
    state: 'open',
    targetBranch,
  });
  return existingPr ? getPr(existingPr.number) : null;
}

async function getStatusCheck(branchName: string): Promise<GitStatus[]> {
  const azureApiGit = await azureApi.gitApi();
  const branch = await azureApiGit.getBranch(
    config.repoId,

    // TODO: fix undefined (#22198)
    getBranchNameWithoutRefsheadsPrefix(branchName)!
  );
  // only grab the latest statuses, it will group any by context
  return azureApiGit.getStatuses(
    // TODO #22198
    branch.commit!.commitId!,
    config.repoId,
    undefined,
    undefined,
    undefined,
    true
  );
}

const azureToRenovateStatusMapping: Record<GitStatusState, BranchStatus> = {
  [GitStatusState.Succeeded]: 'green',
  [GitStatusState.NotApplicable]: 'green',
  [GitStatusState.NotSet]: 'yellow',
  [GitStatusState.Pending]: 'yellow',
  [GitStatusState.Error]: 'red',
  [GitStatusState.Failed]: 'red',
};

export async function getBranchStatusCheck(
  branchName: string,
  context: string
): Promise<BranchStatus | null> {
  const res = await getStatusCheck(branchName);
  for (const check of res) {
    if (getGitStatusContextCombinedName(check.context) === context) {
      // TODO #22198
      return azureToRenovateStatusMapping[check.state!] ?? 'yellow';
    }
  }
  return null;
}

export async function getBranchStatus(
  branchName: string,
  internalChecksAsSuccess: boolean
): Promise<BranchStatus> {
  logger.debug(`getBranchStatus(${branchName})`);
  const statuses = await getStatusCheck(branchName);
  logger.debug({ branch: branchName, statuses }, 'branch status check result');
  if (!statuses.length) {
    logger.debug('empty branch status check result = returning "pending"');
    return 'yellow';
  }
  const noOfFailures = statuses.filter(
    (status) =>
      status.state === GitStatusState.Error ||
      status.state === GitStatusState.Failed
  ).length;
  if (noOfFailures) {
    return 'red';
  }
  const noOfPending = statuses.filter(
    (status) =>
      status.state === GitStatusState.NotSet ||
      status.state === GitStatusState.Pending
  ).length;
  if (noOfPending) {
    return 'yellow';
  }
  if (
    !internalChecksAsSuccess &&
    statuses.every(
      (status) =>
        status.state === GitStatusState.Succeeded &&
        status.context?.genre === 'renovate'
    )
  ) {
    logger.debug(
      'Successful checks are all internal renovate/ checks, so returning "pending" branch status'
    );
    return 'yellow';
  }
  return 'green';
}

async function getMergeStrategy(
  targetRefName: string
): Promise<GitPullRequestMergeStrategy> {
  return (
    config.mergeMethods[targetRefName] ??
    (config.mergeMethods[targetRefName] = await azureHelper.getMergeMethod(
      config.repoId,
      config.project,
      targetRefName,
      config.defaultBranch
    ))
  );
}

export async function createPr({
  sourceBranch,
  targetBranch,
  prTitle: title,
  prBody: body,
  labels,
  draftPR = false,
  platformOptions,
}: CreatePRConfig): Promise<Pr> {
  const sourceRefName = getNewBranchName(sourceBranch);
  const targetRefName = getNewBranchName(targetBranch);
  const description = max4000Chars(sanitize(body));
  const azureApiGit = await azureApi.gitApi();
  const workItemRefs = [
    {
      id: platformOptions?.azureWorkItemId?.toString(),
    },
  ];
  let pr: GitPullRequest = await azureApiGit.createPullRequest(
    {
      sourceRefName,
      targetRefName,
      title,
      description,
      workItemRefs,
      isDraft: draftPR,
    },
    config.repoId
  );
  if (platformOptions?.usePlatformAutomerge) {
    const mergeStrategy = await getMergeStrategy(pr.targetRefName!);
    pr = await azureApiGit.updatePullRequest(
      {
        autoCompleteSetBy: {
          // TODO #22198
          id: pr.createdBy!.id,
        },
        completionOptions: {
          mergeStrategy,
          deleteSourceBranch: true,
          mergeCommitMessage: title,
        },
      },
      config.repoId,
      // TODO #22198
      pr.pullRequestId!
    );
  }
  if (platformOptions?.autoApprove) {
    await azureApiGit.createPullRequestReviewer(
      {
        reviewerUrl: pr.createdBy!.url,
        vote: AzurePrVote.Approved,
        isFlagged: false,
        isRequired: false,
      },
      config.repoId,
      // TODO #22198
      pr.pullRequestId!,
      pr.createdBy!.id!
    );
  }
  await Promise.all(
    labels!.map((label) =>
      azureApiGit.createPullRequestLabel(
        {
          name: label,
        },
        config.repoId,
        // TODO #22198
        pr.pullRequestId!
      )
    )
  );
  return getRenovatePRFormat(pr);
}

export async function updatePr({
  number: prNo,
  prTitle: title,
  prBody: body,
  state,
  platformOptions,
  targetBranch,
}: UpdatePrConfig): Promise<void> {
  logger.debug(`updatePr(${prNo}, ${title}, body)`);

  const azureApiGit = await azureApi.gitApi();
  const objToUpdate: GitPullRequest = {
    title,
  };

  if (targetBranch) {
    objToUpdate.targetRefName = getNewBranchName(targetBranch);
  }

  if (body) {
    objToUpdate.description = max4000Chars(sanitize(body));
  }

  if (state === 'open') {
    await azureApiGit.updatePullRequest(
      {
        status: PullRequestStatus.Active,
      },
      config.repoId,
      prNo
    );
  } else if (state === 'closed') {
    objToUpdate.status = PullRequestStatus.Abandoned;
  }
  if (platformOptions?.autoApprove) {
    const pr = await azureApiGit.getPullRequestById(prNo, config.project);
    await azureApiGit.createPullRequestReviewer(
      {
        reviewerUrl: pr.createdBy!.url,
        vote: AzurePrVote.Approved,
        isFlagged: false,
        isRequired: false,
      },
      config.repoId,
      // TODO #22198
      pr.pullRequestId!,
      pr.createdBy!.id!
    );
  }

  await azureApiGit.updatePullRequest(objToUpdate, config.repoId, prNo);
}

export async function ensureComment({
  number,
  topic,
  content,
}: EnsureCommentConfig): Promise<boolean> {
  logger.debug(`ensureComment(${number}, ${topic!}, content)`);
  const header = topic ? `### ${topic}\n\n` : '';
  const body = `${header}${sanitize(massageMarkdown(content))}`;
  const azureApiGit = await azureApi.gitApi();

  const threads = await azureApiGit.getThreads(config.repoId, number);
  let threadIdFound: number | undefined;
  let commentIdFound: number | undefined;
  let commentNeedsUpdating = false;
  threads.forEach((thread) => {
    const firstCommentContent = thread.comments?.[0].content;
    if (
      (topic && firstCommentContent?.startsWith(header)) === true ||
      (!topic && firstCommentContent === body)
    ) {
      threadIdFound = thread.id;
      commentIdFound = thread.comments?.[0].id;
      commentNeedsUpdating = firstCommentContent !== body;
    }
  });

  if (!threadIdFound) {
    await azureApiGit.createThread(
      {
        comments: [{ content: body, commentType: 1, parentCommentId: 0 }],
        status: 1,
      },
      config.repoId,
      number
    );
    logger.info(
      { repository: config.repository, issueNo: number, topic },
      'Comment added'
    );
  } else if (commentNeedsUpdating) {
    await azureApiGit.updateComment(
      {
        content: body,
      },
      config.repoId,
      number,
      threadIdFound,
      // TODO #22198
      commentIdFound!
    );
    logger.debug(
      { repository: config.repository, issueNo: number, topic },
      'Comment updated'
    );
  } else {
    logger.debug(
      { repository: config.repository, issueNo: number, topic },
      'Comment is already update-to-date'
    );
  }

  return true;
}

export async function ensureCommentRemoval(
  removeConfig: EnsureCommentRemovalConfig
): Promise<void> {
  const { number: issueNo } = removeConfig;
  const key =
    removeConfig.type === 'by-topic'
      ? removeConfig.topic
      : removeConfig.content;
  logger.debug(`Ensuring comment "${key}" in #${issueNo} is removed`);

  const azureApiGit = await azureApi.gitApi();
  const threads = await azureApiGit.getThreads(config.repoId, issueNo);

  let threadIdFound: number | null | undefined = null;
  if (removeConfig.type === 'by-topic') {
    const thread = threads.find(
      (thread: GitPullRequestCommentThread): boolean =>
        !!thread.comments?.[0].content?.startsWith(
          `### ${removeConfig.topic}\n\n`
        )
    );
    threadIdFound = thread?.id;
  } else {
    const thread = threads.find(
      (thread: GitPullRequestCommentThread): boolean =>
        thread.comments?.[0].content?.trim() === removeConfig.content
    );
    threadIdFound = thread?.id;
  }

  if (threadIdFound) {
    await azureApiGit.updateThread(
      {
        status: 4, // close
      },
      config.repoId,
      issueNo,
      threadIdFound
    );
  }
}

const renovateToAzureStatusMapping: Record<BranchStatus, GitStatusState> = {
  ['green']: GitStatusState.Succeeded,
  ['yellow']: GitStatusState.Pending,
  ['red']: GitStatusState.Failed,
};

export async function setBranchStatus({
  branchName,
  context,
  description,
  state,
  url: targetUrl,
}: BranchStatusConfig): Promise<void> {
  logger.debug(
    `setBranchStatus(${branchName}, ${context}, ${description}, ${state}, ${targetUrl!})`
  );
  const azureApiGit = await azureApi.gitApi();
  const branch = await azureApiGit.getBranch(
    config.repoId,
    getBranchNameWithoutRefsheadsPrefix(branchName)!
  );
  const statusToCreate: GitStatus = {
    description,
    context: getGitStatusContextFromCombinedName(context),
    state: renovateToAzureStatusMapping[state],
    targetUrl,
  };
  await azureApiGit.createCommitStatus(
    statusToCreate,
    // TODO #22198
    branch.commit!.commitId!,
    config.repoId
  );
  logger.trace(`Created commit status of ${state} on branch ${branchName}`);
}

export async function mergePr({
  branchName,
  id: pullRequestId,
}: MergePRConfig): Promise<boolean> {
  logger.debug(`mergePr(${pullRequestId}, ${branchName!})`);
  const azureApiGit = await azureApi.gitApi();

  let pr = await azureApiGit.getPullRequestById(pullRequestId, config.project);

  const mergeStrategy = await getMergeStrategy(pr.targetRefName!);
  const objToUpdate: GitPullRequest = {
    status: PullRequestStatus.Completed,
    lastMergeSourceCommit: pr.lastMergeSourceCommit,
    completionOptions: {
      mergeStrategy,
      deleteSourceBranch: true,
      mergeCommitMessage: pr.title,
    },
  };

  logger.trace(
    `Updating PR ${pullRequestId} to status ${PullRequestStatus.Completed} (${
      PullRequestStatus[PullRequestStatus.Completed]
    }) with lastMergeSourceCommit ${
      // TODO: types (#22198)
      pr.lastMergeSourceCommit?.commitId
    } using mergeStrategy ${mergeStrategy} (${
      GitPullRequestMergeStrategy[mergeStrategy]
    })`
  );

  try {
    const response = await azureApiGit.updatePullRequest(
      objToUpdate,
      config.repoId,
      pullRequestId
    );

    let retries = 0;
    let isClosed = response.status === PullRequestStatus.Completed;
    while (!isClosed && retries < 5) {
      retries += 1;
      const sleepMs = retries * 1000;
      logger.trace(
        { pullRequestId, status: pr.status, retries },
        `Updated PR to closed status but change has not taken effect yet. Retrying...`
      );

      await setTimeout(sleepMs);
      pr = await azureApiGit.getPullRequestById(pullRequestId, config.project);
      isClosed = pr.status === PullRequestStatus.Completed;
    }

    if (!isClosed) {
      logger.warn(
        { pullRequestId, status: pr.status },
        `Expected PR to have status ${
          PullRequestStatus[PullRequestStatus.Completed]
          // TODO #22198
        }. However, it is ${PullRequestStatus[pr.status!]}.`
      );
    }
    return true;
  } catch (err) {
    logger.debug({ err }, 'Failed to set the PR as completed.');
    return false;
  }
}

export function massageMarkdown(input: string): string {
  // Remove any HTML we use
  return smartTruncate(input, 4000)
    .replace(
      'you tick the rebase/retry checkbox',
      'rename PR to start with "rebase!"'
    )
    .replace(
      'checking the rebase/retry box above',
      'renaming the PR to start with "rebase!"'
    )
    .replace(regEx(`\n---\n\n.*?<!-- rebase-check -->.*?\n`), '')
    .replace(regEx(/<!--renovate-(?:debug|config-hash):.*?-->/g), '');
}

/* istanbul ignore next */
export function findIssue(): Promise<Issue | null> {
  logger.warn(`findIssue() is not implemented`);
  return Promise.resolve(null);
}

/* istanbul ignore next */
export function ensureIssue(): Promise<EnsureIssueResult | null> {
  logger.warn(`ensureIssue() is not implemented`);
  return Promise.resolve(null);
}

/* istanbul ignore next */
export function ensureIssueClosing(): Promise<void> {
  return Promise.resolve();
}

/* istanbul ignore next */
export function getIssueList(): Promise<Issue[]> {
  logger.debug(`getIssueList()`);
  // TODO: Needs implementation (#9592)
  return Promise.resolve([]);
}

async function getUserIds(users: string[]): Promise<User[]> {
  const azureApiGit = await azureApi.gitApi();
  const azureApiCore = await azureApi.coreApi();
  const repos = await azureApiGit.getRepositories();
  const repo = repos.filter((c) => c.id === config.repoId)[0];
  const requiredReviewerPrefix = 'required:';

  // TODO #22198
  const teams = await azureApiCore.getTeams(repo.project!.id!);
  const members = await Promise.all(
    teams.map(
      async (t) =>
        await azureApiCore.getTeamMembersWithExtendedProperties(
          // TODO #22198
          repo.project!.id!,
          t.id!
        )
    )
  );

  const ids: { id: string; name: string; isRequired: boolean }[] = [];
  members.forEach((listMembers) => {
    listMembers.forEach((m) => {
      users.forEach((r) => {
        let reviewer = r;
        let isRequired = false;
        if (reviewer.startsWith(requiredReviewerPrefix)) {
          reviewer = reviewer.replace(requiredReviewerPrefix, '');
          isRequired = true;
        }
        if (
          reviewer.toLowerCase() === m.identity?.displayName?.toLowerCase() ||
          reviewer.toLowerCase() === m.identity?.uniqueName?.toLowerCase()
        ) {
          if (ids.filter((c) => c.id === m.identity?.id).length === 0) {
            // TODO #22198
            ids.push({
              id: m.identity.id!,
              name: reviewer,
              isRequired,
            });
          }
        }
      });
    });
  });

  teams.forEach((t) => {
    users.forEach((r) => {
      let reviewer = r;
      let isRequired = false;
      if (reviewer.startsWith(requiredReviewerPrefix)) {
        reviewer = reviewer.replace(requiredReviewerPrefix, '');
        isRequired = true;
      }
      if (reviewer.toLowerCase() === t.name?.toLowerCase()) {
        if (ids.filter((c) => c.id === t.id).length === 0) {
          // TODO #22198
          ids.push({ id: t.id!, name: reviewer, isRequired });
        }
      }
    });
  });

  return ids;
}

/**
 *
 * @param {number} issueNo
 * @param {string[]} assignees
 */
export async function addAssignees(
  issueNo: number,
  assignees: string[]
): Promise<void> {
  logger.trace(`addAssignees(${issueNo}, [${assignees.join(', ')}])`);
  const ids = await getUserIds(assignees);
  await ensureComment({
    number: issueNo,
    topic: 'Add Assignees',
    content: ids.map((a) => `@<${a.id}>`).join(', '),
  });
}

/**
 *
 * @param {number} prNo
 * @param {string[]} reviewers
 */
export async function addReviewers(
  prNo: number,
  reviewers: string[]
): Promise<void> {
  logger.trace(`addReviewers(${prNo}, [${reviewers.join(', ')}])`);
  const azureApiGit = await azureApi.gitApi();

  const ids = await getUserIds(reviewers);

  await Promise.all(
    ids.map(async (obj) => {
      await azureApiGit.createPullRequestReviewer(
        {
          isRequired: obj.isRequired,
        },
        config.repoId,
        prNo,
        obj.id
      );
      logger.debug(`Reviewer added: ${obj.name}`);
    })
  );
}

export async function deleteLabel(
  prNumber: number,
  label: string
): Promise<void> {
  logger.debug(`Deleting label ${label} from #${prNumber}`);
  const azureApiGit = await azureApi.gitApi();
  await azureApiGit.deletePullRequestLabels(config.repoId, prNumber, label);
}
