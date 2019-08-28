import * as azureHelper from './azure-helper';
import * as azureApi from './azure-got-wrapper';
import * as hostRules from '../../util/host-rules';
import { appSlug } from '../../config/app-strings';
import GitStorage from '../git/storage';
import { logger } from '../../logger';
import { PlatformConfig, RepoParams, RepoConfig } from '../common';

interface Config {
  storage: GitStorage;
  repoForceRebase: boolean;
  mergeMethod: string;
  baseCommitSHA: string | undefined;
  baseBranch: string;
  defaultBranch: string;
  owner: string;
  repoId: string;
  azureWorkItemId: any;
  prList: null;
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
}) {
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

export async function getRepos() {
  logger.info('Autodiscovering Azure DevOps repositories');
  const azureApiGit = await azureApi.gitApi();
  const repos = await azureApiGit.getRepositories();
  return repos.map(repo => `${repo.project!.name}/${repo.name}`);
}

export async function initRepo({
  repository,
  localDir,
  azureWorkItemId,
  optimizeForDisabled,
}: RepoParams) {
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
  config.owner = '?owner?';
  logger.debug(`${repository} owner = ${config.owner}`);
  // Use default branch as PR target unless later overridden
  config.defaultBranch = repo.defaultBranch!.replace('refs/heads/', '');
  config.baseBranch = config.defaultBranch;
  logger.debug(`${repository} default branch = ${config.defaultBranch}`);
  config.baseCommitSHA = await getBranchCommit(config.baseBranch);
  config.mergeMethod = 'merge';
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
      throw new Error('disabled');
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

export function getRepoForceRebase() {
  return false;
}

export /* istanbul ignore next */ async function setBaseBranch(
  branchName = config.baseBranch
) {
  logger.debug(`Setting baseBranch to ${branchName}`);
  config.baseBranch = branchName;
  delete config.baseCommitSHA;
  delete config.fileList;
  await config.storage.setBaseBranch(branchName);
  await getFileList(branchName);
}

export /* istanbul ignore next */ function setBranchPrefix(
  branchPrefix: string
) {
  return config.storage.setBranchPrefix(branchPrefix);
}

// Search

export /* istanbul ignore next */ function getFileList(branchName: string) {
  return config.storage.getFileList(branchName);
}

// Branch

export /* istanbul ignore next */ function branchExists(branchName: string) {
  return config.storage.branchExists(branchName);
}

export /* istanbul ignore next */ function getAllRenovateBranches(
  branchPrefix: string
) {
  return config.storage.getAllRenovateBranches(branchPrefix);
}

export /* istanbul ignore next */ function isBranchStale(branchName: string) {
  return config.storage.isBranchStale(branchName);
}

export /* istanbul ignore next */ function getFile(
  filePath: string,
  branchName: string
) {
  return config.storage.getFile(filePath, branchName);
}

export /* istanbul ignore next */ async function deleteBranch(
  branchName: string,
  abandonAssociatedPr = false
) {
  await config.storage.deleteBranch(branchName);
  if (abandonAssociatedPr) {
    const pr = await getBranchPr(branchName);
    await abandonPr(pr.number);
  }
}

export /* istanbul ignore next */ function getBranchLastCommitTime(
  branchName: string
) {
  return config.storage.getBranchLastCommitTime(branchName);
}

export /* istanbul ignore next */ function getRepoStatus() {
  return config.storage.getRepoStatus();
}

export /* istanbul ignore next */ function mergeBranch(branchName: string) {
  return config.storage.mergeBranch(branchName);
}

export /* istanbul ignore next */ function commitFilesToBranch(
  branchName: string,
  files: any[],
  message: string,
  parentBranch = config.baseBranch
) {
  return config.storage.commitFilesToBranch(
    branchName,
    files,
    message,
    parentBranch
  );
}

export /* istanbul ignore next */ function getCommitMessages() {
  return config.storage.getCommitMessages();
}

async function getBranchCommit(fullBranchName: string) {
  const azureApiGit = await azureApi.gitApi();
  const commit = await azureApiGit.getBranch(
    config.repoId,
    azureHelper.getBranchNameWithoutRefsheadsPrefix(fullBranchName)!
  );
  return commit.commit!.commitId;
}

export function getPrList() {
  return [];
}

export async function findPr(
  branchName: string,
  prTitle: string | null,
  state = 'all'
) {
  logger.debug(`findPr(${branchName}, ${prTitle}, ${state})`);
  let prsFiltered: any[] = [];
  try {
    const azureApiGit = await azureApi.gitApi();
    const prs = await azureApiGit.getPullRequests(config.repoId, { status: 4 });

    prsFiltered = prs.filter(
      item => item.sourceRefName === azureHelper.getNewBranchName(branchName)
    );

    if (prTitle) {
      prsFiltered = prsFiltered.filter(item => item.title === prTitle);
    }

    // update format
    prsFiltered = prsFiltered.map(item =>
      azureHelper.getRenovatePRFormat(item)
    );

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

export async function getBranchPr(branchName: string) {
  logger.debug(`getBranchPr(${branchName})`);
  const existingPr = await findPr(branchName, null, 'open');
  return existingPr ? getPr(existingPr.pullRequestId) : null;
}

export async function getBranchStatus(
  branchName: string,
  requiredStatusChecks: any
) {
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

export async function getBranchStatusCheck(
  branchName: string,
  context?: string
) {
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

export async function getPr(pullRequestId: number) {
  logger.debug(`getPr(${pullRequestId})`);
  if (!pullRequestId) {
    return null;
  }
  const azureApiGit = await azureApi.gitApi();
  const prs = await azureApiGit.getPullRequests(config.repoId, { status: 4 });
  const azurePr: any = prs.find(item => item.pullRequestId === pullRequestId);
  if (!azurePr) {
    return null;
  }
  const labels = await azureApiGit.getPullRequestLabels(
    config.repoId,
    pullRequestId
  );
  azurePr.labels = labels
    .filter(label => label.active)
    .map(label => label.name);
  logger.debug(`pr: (${azurePr})`);
  const pr = azureHelper.getRenovatePRFormat(azurePr);
  return pr;
}

export async function createPr(
  branchName: string,
  title: string,
  body: string,
  labels: string[],
  useDefaultBranch?: boolean,
  platformOptions: any = {}
) {
  const sourceRefName = azureHelper.getNewBranchName(branchName);
  const targetRefName = azureHelper.getNewBranchName(
    useDefaultBranch ? config.defaultBranch : config.baseBranch
  );
  const description = azureHelper.max4000Chars(body);
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
          squashMerge: true,
          deleteSourceBranch: true,
        },
      },
      config.repoId,
      pr.pullRequestId!
    );
  }
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

export async function updatePr(prNo: number, title: string, body?: string) {
  logger.debug(`updatePr(${prNo}, ${title}, body)`);
  const azureApiGit = await azureApi.gitApi();
  const objToUpdate: any = {
    title,
  };
  if (body) {
    objToUpdate.description = azureHelper.max4000Chars(body);
  }
  await azureApiGit.updatePullRequest(objToUpdate, config.repoId, prNo);
}

export async function ensureComment(
  issueNo: number,
  topic: string | null,
  content: string
) {
  logger.debug(`ensureComment(${issueNo}, ${topic}, content)`);
  const body = `### ${topic}\n\n${content}`;
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

export async function ensureCommentRemoval(issueNo: number, topic: string) {
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

// istanbul ignore next
async function abandonPr(prNo: number) {
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

export function setBranchStatus(
  branchName: string,
  context: string,
  description: string,
  state: string,
  targetUrl: string
) {
  logger.debug(
    `setBranchStatus(${branchName}, ${context}, ${description}, ${state}, ${targetUrl}) - Not supported by Azure DevOps (yet!)`
  );
}

export async function mergePr(pr: number) {
  logger.info(`mergePr(pr)(${pr}) - Not supported by Azure DevOps (yet!)`);
  await null;
}

export function getPrBody(input: string) {
  // Remove any HTML we use
  return input
    .replace(new RegExp(`\n---\n\n.*?<!-- ${appSlug}-rebase -->.*?\n`), '')
    .replace('<summary>', '**')
    .replace('</summary>', '**')
    .replace('<details>', '')
    .replace('</details>', '');
}

export /* istanbul ignore next */ function findIssue() {
  logger.warn(`findIssue() is not implemented`);
}

export /* istanbul ignore next */ function ensureIssue() {
  logger.warn(`ensureIssue() is not implemented`);
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export /* istanbul ignore next */ function ensureIssueClosing() {}

export /* istanbul ignore next */ function getIssueList() {
  logger.debug(`getIssueList()`);
  // TODO: Needs implementation
  return [];
}

/**
 *
 * @param {number} issueNo
 * @param {string[]} assignees
 */
export async function addAssignees(issueNo: number, assignees: string[]) {
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
export async function addReviewers(prNo: number, reviewers: string[]) {
  logger.trace(`addReviewers(${prNo}, ${reviewers})`);
  const azureApiGit = await azureApi.gitApi();
  const azureApiCore = await azureApi.getCoreApi();
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
) {
  logger.debug(`Deleting label ${label} from #${prNumber}`);
  const azureApiGit = await azureApi.gitApi();
  await azureApiGit.deletePullRequestLabels(config.repoId, prNumber, label);
}

// to become async?
export function getPrFiles(prNo: number) {
  logger.info(
    `getPrFiles(prNo)(${prNo}) - Not supported by Azure DevOps (yet!)`
  );
  return [];
}

export function getVulnerabilityAlerts() {
  return [];
}

export function cleanRepo() {
  // istanbul ignore if
  if (config.storage && config.storage.cleanRepo) {
    config.storage.cleanRepo();
  }
  config = {} as any;
}
