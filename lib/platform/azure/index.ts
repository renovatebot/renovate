import {
  GitPullRequestMergeStrategy,
  GitPullRequest,
} from 'azure-devops-node-api/interfaces/GitInterfaces';

import * as azureHelper from './azure-helper';
import * as azureApi from './azure-got-wrapper';
import * as hostRules from '../../util/host-rules';
import GitStorage, { StatusResult, CommitFilesConfig } from '../git/storage';
import { logger } from '../../logger';
import {
  PlatformConfig,
  RepoParams,
  RepoConfig,
  Pr,
  Issue,
  VulnerabilityAlert,
  CreatePRConfig,
  BranchStatusConfig,
} from '../common';
import { sanitize } from '../../util/sanitize';
import { smartTruncate } from '../utils/pr-body';
import { REPOSITORY_DISABLED } from '../../constants/error-messages';

interface Config {
  storage: GitStorage;
  repoForceRebase: boolean;
  mergeMethod: GitPullRequestMergeStrategy;
  baseCommitSHA: string | undefined;
  baseBranch: string;
  defaultBranch: string;
  owner: string;
  repoId: string;
  project: string;
  azureWorkItemId: any;
  prList: Pr[];
  fileList: null;
  repository: string;
}

let config: Config = {} as any;

const defaults: any = {
  hostType: 'azure',
};

export function initPlatform({
  endpoint,
  token,
}: {
  endpoint: string;
  token: string;
}): PlatformConfig {
  if (!endpoint) {
    throw new Error('Init: You must configure an Azure DevOps endpoint');
  }
  if (!token) {
    throw new Error('Init: You must configure an Azure DevOps token');
  }
  // TODO: Add a connection check that endpoint/token combination are valid
  const res = {
    endpoint: endpoint.replace(/\/?$/, '/'), // always add a trailing slash
  };
  defaults.endpoint = res.endpoint;
  azureApi.setEndpoint(res.endpoint);
  const platformConfig: PlatformConfig = {
    endpoint: defaults.endpoint,
  };
  return platformConfig;
}

export async function getRepos(): Promise<string[]> {
  logger.info('Autodiscovering Azure DevOps repositories');
  const azureApiGit = await azureApi.gitApi();
  const repos = await azureApiGit.getRepositories();
  return repos.map(repo => `${repo.project!.name}/${repo.name}`);
}

async function getBranchCommit(fullBranchName: string): Promise<string> {
  const azureApiGit = await azureApi.gitApi();
  const commit = await azureApiGit.getBranch(
    config.repoId,
    azureHelper.getBranchNameWithoutRefsheadsPrefix(fullBranchName)!
  );
  return commit.commit!.commitId;
}

export async function initRepo({
  repository,
  localDir,
  azureWorkItemId,
  optimizeForDisabled,
}: RepoParams): Promise<RepoConfig> {
  logger.debug(`initRepo("${repository}")`);
  config = { repository, azureWorkItemId } as any;
  const azureApiGit = await azureApi.gitApi();
  const repos = await azureApiGit.getRepositories();
  const names = azureHelper.getProjectAndRepo(repository);
  const repo = repos.filter(
    c =>
      c.name!.toLowerCase() === names.repo.toLowerCase() &&
      c.project!.name!.toLowerCase() === names.project.toLowerCase()
  )[0];
  logger.debug({ repositoryDetails: repo }, 'Repository details');
  config.repoId = repo.id!;
  config.project = repo.project!.name;
  config.owner = '?owner?';
  logger.debug(`${repository} owner = ${config.owner}`);
  // Use default branch as PR target unless later overridden
  config.defaultBranch = repo.defaultBranch!.replace('refs/heads/', '');
  config.baseBranch = config.defaultBranch;
  logger.debug(`${repository} default branch = ${config.defaultBranch}`);
  config.baseCommitSHA = await getBranchCommit(config.baseBranch);
  config.mergeMethod = await azureHelper.getMergeMethod(repo.id, names.project);
  config.repoForceRebase = false;

  if (optimizeForDisabled) {
    interface RenovateConfig {
      enabled: boolean;
    }
    let renovateConfig: RenovateConfig;
    try {
      const json = await azureHelper.getFile(
        repo.id,
        'renovate.json',
        config.defaultBranch
      );
      renovateConfig = JSON.parse(json);
    } catch {
      // Do nothing
    }
    if (renovateConfig && renovateConfig.enabled === false) {
      throw new Error(REPOSITORY_DISABLED);
    }
  }

  config.storage = new GitStorage();
  const [projectName, repoName] = repository.split('/');
  const opts = hostRules.find({
    hostType: defaults.hostType,
    url: defaults.endpoint,
  });
  const url =
    defaults.endpoint.replace('https://', `https://token:${opts.token}@`) +
    `${encodeURIComponent(projectName)}/_git/${encodeURIComponent(repoName)}`;
  await config.storage.initRepo({
    ...config,
    localDir,
    url,
  });
  const repoConfig: RepoConfig = {
    baseBranch: config.baseBranch,
    isFork: false,
  };
  return repoConfig;
}

export function getRepoForceRebase(): boolean {
  return false;
}

// Search

export /* istanbul ignore next */ function getFileList(
  branchName: string
): Promise<string[]> {
  return config.storage.getFileList(branchName);
}

export /* istanbul ignore next */ async function setBaseBranch(
  branchName = config.baseBranch
): Promise<void> {
  logger.debug(`Setting baseBranch to ${branchName}`);
  config.baseBranch = branchName;
  delete config.baseCommitSHA;
  delete config.fileList;
  await config.storage.setBaseBranch(branchName);
  await getFileList(branchName);
}

export /* istanbul ignore next */ function setBranchPrefix(
  branchPrefix: string
): Promise<void> {
  return config.storage.setBranchPrefix(branchPrefix);
}

// Branch

export /* istanbul ignore next */ function branchExists(
  branchName: string
): Promise<boolean> {
  return config.storage.branchExists(branchName);
}

export /* istanbul ignore next */ function getAllRenovateBranches(
  branchPrefix: string
): Promise<string[]> {
  return config.storage.getAllRenovateBranches(branchPrefix);
}

export /* istanbul ignore next */ function isBranchStale(
  branchName: string
): Promise<boolean> {
  return config.storage.isBranchStale(branchName);
}

export /* istanbul ignore next */ function getFile(
  filePath: string,
  branchName: string
): Promise<string> {
  return config.storage.getFile(filePath, branchName);
}

// istanbul ignore next
async function abandonPr(prNo: number): Promise<void> {
  logger.debug(`abandonPr(prNo)(${prNo})`);
  const azureApiGit = await azureApi.gitApi();
  await azureApiGit.updatePullRequest(
    {
      status: 2,
    },
    config.repoId,
    prNo
  );
}

export async function getPrList(): Promise<Pr[]> {
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
    config.prList = prs.map(azureHelper.getRenovatePRFormat);
    logger.info({ length: config.prList.length }, 'Retrieved Pull Requests');
  }
  return config.prList;
}

export async function getPr(pullRequestId: number): Promise<Pr | null> {
  logger.debug(`getPr(${pullRequestId})`);
  if (!pullRequestId) {
    return null;
  }
  const azurePr = (await getPrList()).find(
    item => item.pullRequestId === pullRequestId
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
    .filter(label => label.active)
    .map(label => label.name);
  return azurePr;
}

export async function findPr(
  branchName: string,
  prTitle: string | null,
  state = 'all'
): Promise<Pr | null> {
  logger.debug(`findPr(${branchName}, ${prTitle}, ${state})`);
  // TODO: fix typing
  let prsFiltered: any[] = [];
  try {
    const prs = await getPrList();

    prsFiltered = prs.filter(
      item => item.sourceRefName === azureHelper.getNewBranchName(branchName)
    );

    if (prTitle) {
      prsFiltered = prsFiltered.filter(item => item.title === prTitle);
    }

    switch (state) {
      case 'all':
        // no more filter needed, we can go further...
        break;
      case '!open':
        prsFiltered = prsFiltered.filter(item => item.state !== 'open');
        break;
      default:
        prsFiltered = prsFiltered.filter(item => item.state === state);
        break;
    }
  } catch (error) {
    logger.error('findPr ' + error);
  }
  if (prsFiltered.length === 0) {
    return null;
  }
  return prsFiltered[0];
}

export async function getBranchPr(branchName: string): Promise<Pr | null> {
  logger.debug(`getBranchPr(${branchName})`);
  const existingPr = await findPr(branchName, null, 'open');
  return existingPr ? getPr(existingPr.pullRequestId) : null;
}

export /* istanbul ignore next */ async function deleteBranch(
  branchName: string,
  abandonAssociatedPr = false
): Promise<void> {
  await config.storage.deleteBranch(branchName);
  if (abandonAssociatedPr) {
    const pr = await getBranchPr(branchName);
    await abandonPr(pr.number);
  }
}

export /* istanbul ignore next */ function getBranchLastCommitTime(
  branchName: string
): Promise<Date> {
  return config.storage.getBranchLastCommitTime(branchName);
}

export /* istanbul ignore next */ function getRepoStatus(): Promise<
  StatusResult
> {
  return config.storage.getRepoStatus();
}

export /* istanbul ignore next */ function mergeBranch(
  branchName: string
): Promise<void> {
  return config.storage.mergeBranch(branchName);
}

export /* istanbul ignore next */ function commitFilesToBranch({
  branchName,
  files,
  message,
  parentBranch = config.baseBranch,
}: CommitFilesConfig): Promise<void> {
  return config.storage.commitFilesToBranch({
    branchName,
    files,
    message,
    parentBranch,
  });
}

export /* istanbul ignore next */ function getCommitMessages(): Promise<
  string[]
> {
  return config.storage.getCommitMessages();
}

export async function getBranchStatusCheck(
  branchName: string,
  context?: string
): Promise<string> {
  logger.trace(`getBranchStatusCheck(${branchName}, ${context})`);
  const azureApiGit = await azureApi.gitApi();
  const branch = await azureApiGit.getBranch(
    config.repoId,
    azureHelper.getBranchNameWithoutRefsheadsPrefix(branchName)!
  );
  if (branch.aheadCount === 0) {
    return 'success';
  }
  return 'pending';
}

export async function getBranchStatus(
  branchName: string,
  requiredStatusChecks: any
): Promise<string> {
  logger.debug(`getBranchStatus(${branchName})`);
  if (!requiredStatusChecks) {
    // null means disable status checks, so it always succeeds
    return 'success';
  }
  if (requiredStatusChecks.length) {
    // This is Unsupported
    logger.warn({ requiredStatusChecks }, `Unsupported requiredStatusChecks`);
    return 'failed';
  }
  const branchStatusCheck = await getBranchStatusCheck(branchName);
  return branchStatusCheck;
}

export async function createPr({
  branchName,
  prTitle: title,
  prBody: body,
  labels,
  useDefaultBranch,
  platformOptions = {},
}: CreatePRConfig): Promise<Pr> {
  const sourceRefName = azureHelper.getNewBranchName(branchName);
  const targetRefName = azureHelper.getNewBranchName(
    useDefaultBranch ? config.defaultBranch : config.baseBranch
  );
  const description = azureHelper.max4000Chars(sanitize(body));
  const azureApiGit = await azureApi.gitApi();
  const workItemRefs = [
    {
      id: config.azureWorkItemId,
    },
  ];
  let pr: any = await azureApiGit.createPullRequest(
    {
      sourceRefName,
      targetRefName,
      title,
      description,
      workItemRefs,
    },
    config.repoId
  );
  if (platformOptions.azureAutoComplete) {
    pr = await azureApiGit.updatePullRequest(
      {
        autoCompleteSetBy: {
          id: pr.createdBy!.id,
        },
        completionOptions: {
          mergeStrategy: config.mergeMethod,
          deleteSourceBranch: true,
        },
      },
      config.repoId,
      pr.pullRequestId!
    );
  }
  // TODO: fixme
  await labels.forEach(async label => {
    await azureApiGit.createPullRequestLabel(
      {
        name: label,
      },
      config.repoId,
      pr.pullRequestId!
    );
  });
  pr.branchName = branchName;
  return azureHelper.getRenovatePRFormat(pr);
}

export async function updatePr(
  prNo: number,
  title: string,
  body?: string
): Promise<void> {
  logger.debug(`updatePr(${prNo}, ${title}, body)`);
  const azureApiGit = await azureApi.gitApi();
  const objToUpdate: any = {
    title,
  };
  if (body) {
    objToUpdate.description = azureHelper.max4000Chars(sanitize(body));
  }
  await azureApiGit.updatePullRequest(objToUpdate, config.repoId, prNo);
}

export async function ensureComment(
  issueNo: number,
  topic: string | null,
  content: string
): Promise<void> {
  logger.debug(`ensureComment(${issueNo}, ${topic}, content)`);
  const body = `### ${topic}\n\n${sanitize(content)}`;
  const azureApiGit = await azureApi.gitApi();
  await azureApiGit.createThread(
    {
      comments: [{ content: body, commentType: 1, parentCommentId: 0 }],
      status: 1,
    },
    config.repoId,
    issueNo
  );
}

export async function ensureCommentRemoval(
  issueNo: number,
  topic: string
): Promise<void> {
  logger.debug(`ensureCommentRemoval(issueNo, topic)(${issueNo}, ${topic})`);
  if (issueNo) {
    const azureApiGit = await azureApi.gitApi();
    const threads = await azureApiGit.getThreads(config.repoId, issueNo);
    let threadIdFound = null;

    threads.forEach(thread => {
      if (thread.comments![0].content!.startsWith(`### ${topic}\n\n`)) {
        threadIdFound = thread.id;
      }
    });

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
}

export function setBranchStatus({
  branchName,
  context,
  description,
  state,
  url: targetUrl,
}: BranchStatusConfig): void {
  logger.debug(
    `setBranchStatus(${branchName}, ${context}, ${description}, ${state}, ${targetUrl}) - Not supported by Azure DevOps (yet!)`
  );
}

export async function mergePr(pr: number): Promise<void> {
  logger.info(`mergePr(pr)(${pr}) - Not supported by Azure DevOps (yet!)`);
  await null;
}

export function getPrBody(input: string): string {
  // Remove any HTML we use
  return smartTruncate(input, 4000)
    .replace(new RegExp(`\n---\n\n.*?<!-- rebase-check -->.*?\n`), '')
    .replace('<summary>', '**')
    .replace('</summary>', '**')
    .replace('<details>', '')
    .replace('</details>', '');
}

export /* istanbul ignore next */ function findIssue(): Issue | null {
  logger.warn(`findIssue() is not implemented`);
  return null;
}

export /* istanbul ignore next */ function ensureIssue(): void {
  logger.warn(`ensureIssue() is not implemented`);
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export /* istanbul ignore next */ function ensureIssueClosing(): void {}

export /* istanbul ignore next */ function getIssueList(): Issue[] {
  logger.debug(`getIssueList()`);
  // TODO: Needs implementation
  return [];
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
  logger.trace(`addAssignees(${issueNo}, ${assignees})`);
  await ensureComment(
    issueNo,
    'Add Assignees',
    assignees.map(a => `@<${a}>`).join(', ')
  );
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
  logger.trace(`addReviewers(${prNo}, ${reviewers})`);
  const azureApiGit = await azureApi.gitApi();
  const azureApiCore = await azureApi.coreApi();
  const repos = await azureApiGit.getRepositories();
  const repo = repos.filter(c => c.id === config.repoId)[0];
  const teams = await azureApiCore.getTeams(repo!.project!.id!);
  const members = await Promise.all(
    teams.map(
      async t =>
        /* eslint-disable no-return-await */
        await azureApiCore.getTeamMembersWithExtendedProperties(
          repo!.project!.id!,
          t.id!
        )
    )
  );

  const ids: any[] = [];
  members.forEach(listMembers => {
    listMembers.forEach(m => {
      reviewers.forEach(r => {
        if (
          r.toLowerCase() === m.identity!.displayName!.toLowerCase() ||
          r.toLowerCase() === m.identity!.uniqueName!.toLowerCase()
        ) {
          if (ids.filter(c => c.id === m.identity!.id).length === 0) {
            ids.push({ id: m.identity!.id, name: r });
          }
        }
      });
    });
  });

  teams.forEach(t => {
    reviewers.forEach(r => {
      if (r.toLowerCase() === t.name!.toLowerCase()) {
        if (ids.filter(c => c.id === t.id).length === 0) {
          ids.push({ id: t.id, name: r });
        }
      }
    });
  });

  await Promise.all(
    ids.map(async obj => {
      await azureApiGit.createPullRequestReviewer(
        {},
        config.repoId,
        prNo,
        obj.id
      );
      logger.info(`Reviewer added: ${obj.name}`);
    })
  );
}

export /* istanbul ignore next */ async function deleteLabel(
  prNumber: number,
  label: string
): Promise<void> {
  logger.debug(`Deleting label ${label} from #${prNumber}`);
  const azureApiGit = await azureApi.gitApi();
  await azureApiGit.deletePullRequestLabels(config.repoId, prNumber, label);
}

// to become async?
export function getPrFiles(prNo: number): string[] {
  logger.info(
    `getPrFiles(prNo)(${prNo}) - Not supported by Azure DevOps (yet!)`
  );
  return [];
}

export function getVulnerabilityAlerts(): VulnerabilityAlert[] {
  return [];
}

export function cleanRepo(): void {
  // istanbul ignore if
  if (config.storage && config.storage.cleanRepo) {
    config.storage.cleanRepo();
  }
  config = {} as any;
}
