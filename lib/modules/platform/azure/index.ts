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
import delay from 'delay';
import JSON5 from 'json5';
import { PlatformId } from '../../../constants';
import {
  REPOSITORY_ARCHIVED,
  REPOSITORY_EMPTY,
  REPOSITORY_NOT_FOUND,
} from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { BranchStatus, PrState, VulnerabilityAlert } from '../../../types';
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
  getProjectAndRepo,
  getRenovatePRFormat,
  getRepoByName,
  getStorageExtraCloneOpts,
  max4000Chars,
} from './util';

interface Config {
  repoForceRebase: boolean;
  defaultMergeMethod: GitPullRequestMergeStrategy;
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
}

let config: Config = {} as any;

const defaults: {
  endpoint?: string;
  hostType: string;
} = {
  hostType: PlatformId.Azure,
};

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
  // TODO: types (#7154)
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  return repos.map((repo) => `${repo.project?.name}/${repo.name}`);
}

export async function getRawFile(
  fileName: string,
  repoName?: string,
  branchOrTag?: string
): Promise<string | null> {
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
  } as GitVersionDescriptor;

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
}

export async function getJsonFile(
  fileName: string,
  repoName?: string,
  branchOrTag?: string
): Promise<any | null> {
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
  // TODO #7154
  config.repoId = repo.id!;

  config.project = repo.project!.name!;
  config.owner = '?owner?';
  logger.debug(`${repository} owner = ${config.owner}`);
  const defaultBranch = repo.defaultBranch.replace('refs/heads/', '');
  config.defaultBranch = defaultBranch;
  logger.debug(`${repository} default branch = ${defaultBranch}`);
  const names = getProjectAndRepo(repository);
  config.defaultMergeMethod = await azureHelper.getMergeMethod(
    // TODO #7154
    repo.id!,
    names.project,
    null,
    defaultBranch
  );
  config.mergeMethods = {};
  config.repoForceRebase = false;

  const [projectName, repoName] = repository.split('/');
  const opts = hostRules.find({
    hostType: defaults.hostType,
    url: defaults.endpoint,
  });
  // TODO: types (#7154)
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
    logger.debug({ length: config.prList.length }, 'Retrieved Pull Requests');
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
  azurePr.hasReviewers = is.nonEmptyArray(azurePr.reviewers);
  return azurePr;
}

export async function findPr({
  branchName,
  prTitle,
  state = PrState.All,
}: FindPRConfig): Promise<Pr | null> {
  let prsFiltered: Pr[] = [];
  try {
    const prs = await getPrList();

    prsFiltered = prs.filter(
      (item) => item.sourceRefName === getNewBranchName(branchName)
    );

    if (prTitle) {
      prsFiltered = prsFiltered.filter((item) => item.title === prTitle);
    }

    switch (state) {
      case PrState.All:
        // no more filter needed, we can go further...
        break;
      case PrState.NotOpen:
        prsFiltered = prsFiltered.filter((item) => item.state !== PrState.Open);
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

async function getStatusCheck(branchName: string): Promise<GitStatus[]> {
  const azureApiGit = await azureApi.gitApi();
  const branch = await azureApiGit.getBranch(
    config.repoId,

    // TODO: fix undefined (#7154)
    getBranchNameWithoutRefsheadsPrefix(branchName)!
  );
  // only grab the latest statuses, it will group any by context
  return azureApiGit.getStatuses(
    // TODO #7154
    branch.commit!.commitId!,
    config.repoId,
    undefined,
    undefined,
    undefined,
    true
  );
}

const azureToRenovateStatusMapping: Record<GitStatusState, BranchStatus> = {
  [GitStatusState.Succeeded]: BranchStatus.green,
  [GitStatusState.NotApplicable]: BranchStatus.green,
  [GitStatusState.NotSet]: BranchStatus.yellow,
  [GitStatusState.Pending]: BranchStatus.yellow,
  [GitStatusState.Error]: BranchStatus.red,
  [GitStatusState.Failed]: BranchStatus.red,
};

export async function getBranchStatusCheck(
  branchName: string,
  context: string
): Promise<BranchStatus | null> {
  const res = await getStatusCheck(branchName);
  for (const check of res) {
    if (getGitStatusContextCombinedName(check.context) === context) {
      // TODO #7154
      return azureToRenovateStatusMapping[check.state!] ?? BranchStatus.yellow;
    }
  }
  return null;
}

export async function getBranchStatus(
  branchName: string
): Promise<BranchStatus> {
  logger.debug(`getBranchStatus(${branchName})`);
  const statuses = await getStatusCheck(branchName);
  logger.debug({ branch: branchName, statuses }, 'branch status check result');
  if (!statuses.length) {
    logger.debug('empty branch status check result = returning "pending"');
    return BranchStatus.yellow;
  }
  const noOfFailures = statuses.filter(
    (status: GitStatus) =>
      status.state === GitStatusState.Error ||
      status.state === GitStatusState.Failed
  ).length;
  if (noOfFailures) {
    return BranchStatus.red;
  }
  const noOfPending = statuses.filter(
    (status: GitStatus) =>
      status.state === GitStatusState.NotSet ||
      status.state === GitStatusState.Pending
  ).length;
  if (noOfPending) {
    return BranchStatus.yellow;
  }
  return BranchStatus.green;
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
    pr = await azureApiGit.updatePullRequest(
      {
        autoCompleteSetBy: {
          // TODO #7154
          id: pr.createdBy!.id,
        },
        completionOptions: {
          mergeStrategy: config.defaultMergeMethod,
          deleteSourceBranch: true,
          mergeCommitMessage: title,
        },
      },
      config.repoId,
      // TODO #7154
      pr.pullRequestId!
    );
  }
  if (platformOptions?.azureAutoApprove) {
    await azureApiGit.createPullRequestReviewer(
      {
        reviewerUrl: pr.createdBy!.url,
        vote: AzurePrVote.Approved,
        isFlagged: false,
        isRequired: false,
      },
      config.repoId,
      // TODO #7154
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
        // TODO #7154
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
}: UpdatePrConfig): Promise<void> {
  logger.debug(`updatePr(${prNo}, ${title}, body)`);

  const azureApiGit = await azureApi.gitApi();
  const objToUpdate: GitPullRequest = {
    title,
  };

  if (body) {
    objToUpdate.description = max4000Chars(sanitize(body));
  }

  if (state === PrState.Open) {
    await azureApiGit.updatePullRequest(
      { status: PullRequestStatus.Active },
      config.repoId,
      prNo
    );
  } else if (state === PrState.Closed) {
    objToUpdate.status = PullRequestStatus.Abandoned;
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
  const body = `${header}${sanitize(content)}`;
  const azureApiGit = await azureApi.gitApi();

  const threads = await azureApiGit.getThreads(config.repoId, number);
  let threadIdFound: number | undefined;
  let commentIdFound: number | undefined;
  let commentNeedsUpdating = false;
  threads.forEach((thread) => {
    const firstCommentContent = thread.comments?.[0].content;
    if (
      (topic && firstCommentContent?.startsWith(header)) ||
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
      // TODO #7154
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
  [BranchStatus.green]: [GitStatusState.Succeeded],
  [BranchStatus.green]: GitStatusState.Succeeded,
  [BranchStatus.yellow]: GitStatusState.Pending,
  [BranchStatus.red]: GitStatusState.Failed,
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
    // TODO #7154
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

  // TODO #7154
  const mergeMethod =
    config.mergeMethods[pr.targetRefName!] ??
    (config.mergeMethods[pr.targetRefName!] = await azureHelper.getMergeMethod(
      config.repoId,
      config.project,
      pr.targetRefName,
      config.defaultBranch
    ));

  const objToUpdate: GitPullRequest = {
    status: PullRequestStatus.Completed,
    lastMergeSourceCommit: pr.lastMergeSourceCommit,
    completionOptions: {
      mergeStrategy: mergeMethod,
      deleteSourceBranch: true,
      mergeCommitMessage: pr.title,
    },
  };

  logger.trace(
    `Updating PR ${pullRequestId} to status ${PullRequestStatus.Completed} (${
      PullRequestStatus[PullRequestStatus.Completed]
    }) with lastMergeSourceCommit ${
      // TODO: types (#7154)
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      pr.lastMergeSourceCommit?.commitId
    } using mergeStrategy ${mergeMethod} (${
      GitPullRequestMergeStrategy[mergeMethod]
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

      await delay(sleepMs);
      pr = await azureApiGit.getPullRequestById(pullRequestId, config.project);
      isClosed = pr.status === PullRequestStatus.Completed;
    }

    if (!isClosed) {
      logger.warn(
        { pullRequestId, status: pr.status },
        `Expected PR to have status ${
          PullRequestStatus[PullRequestStatus.Completed]
          // TODO #7154
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
    .replace(regEx(`\n---\n\n.*?<!-- rebase-check -->.*?\n`), '')
    .replace(regEx(/<!--renovate-debug:.*?-->/), '');
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

  // TODO #7154
  const teams = await azureApiCore.getTeams(repo.project!.id!);
  const members = await Promise.all(
    teams.map(
      async (t) =>
        await azureApiCore.getTeamMembersWithExtendedProperties(
          // TODO #7154
          repo.project!.id!,
          t.id!
        )
    )
  );

  const ids: { id: string; name: string }[] = [];
  members.forEach((listMembers) => {
    listMembers.forEach((m) => {
      users.forEach((r) => {
        if (
          r.toLowerCase() === m.identity?.displayName?.toLowerCase() ||
          r.toLowerCase() === m.identity?.uniqueName?.toLowerCase()
        ) {
          if (ids.filter((c) => c.id === m.identity?.id).length === 0) {
            // TODO #7154
            ids.push({ id: m.identity.id!, name: r });
          }
        }
      });
    });
  });

  teams.forEach((t) => {
    users.forEach((r) => {
      if (r.toLowerCase() === t.name?.toLowerCase()) {
        if (ids.filter((c) => c.id === t.id).length === 0) {
          // TODO #7154
          ids.push({ id: t.id!, name: r });
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
        {},
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

export function getVulnerabilityAlerts(): Promise<VulnerabilityAlert[]> {
  return Promise.resolve([]);
}
