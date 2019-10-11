import url from 'url';
import delay from 'delay';

import { api } from './bb-got-wrapper';
import * as utils from './utils';
import * as hostRules from '../../util/host-rules';
import GitStorage from '../git/storage';
import { logger } from '../../logger';
import { PlatformConfig, RepoParams, RepoConfig } from '../common';
import { sanitize } from '../../util/sanitize';
import { smartTruncate } from '../utils/pr-body';

/*
 * Version: 5.3 (EOL Date: 15 Aug 2019)
 * See following docs for api information:
 * https://docs.atlassian.com/bitbucket-server/rest/5.3.0/bitbucket-rest.html
 * https://docs.atlassian.com/bitbucket-server/rest/5.3.0/bitbucket-build-rest.html
 *
 * See following page for uptodate supported versions
 * https://confluence.atlassian.com/support/atlassian-support-end-of-life-policy-201851003.html#AtlassianSupportEndofLifePolicy-BitbucketServer
 */

interface BbsConfig {
  baseBranch: string;
  bbUseDefaultReviewers: boolean;
  defaultBranch: string;
  fileList: any[];
  mergeMethod: string;
  owner: string;
  prList: any[];
  projectKey: string;
  repository: string;
  repositorySlug: string;
  storage: GitStorage;

  prVersions: Map<number, number>;

  username: string;
}

let config: BbsConfig = {} as any;

const defaults: any = {
  hostType: 'bitbucket-server',
};

/* istanbul ignore next */
function updatePrVersion(pr: number, version: number) {
  const res = Math.max(config.prVersions.get(pr) || 0, version);
  config.prVersions.set(pr, res);
  return res;
}

export function initPlatform({
  endpoint,
  username,
  password,
}: {
  endpoint: string;
  username: string;
  password: string;
}) {
  if (!endpoint) {
    throw new Error('Init: You must configure a Bitbucket Server endpoint');
  }
  if (!(username && password)) {
    throw new Error(
      'Init: You must configure a Bitbucket Server username/password'
    );
  }
  // TODO: Add a connection check that endpoint/username/password combination are valid
  defaults.endpoint = endpoint.replace(/\/?$/, '/'); // always add a trailing slash
  api.setBaseUrl(defaults.endpoint);
  const platformConfig: PlatformConfig = {
    endpoint: defaults.endpoint,
  };
  return platformConfig;
}

// Get all repositories that the user has access to
export async function getRepos() {
  logger.info('Autodiscovering Bitbucket Server repositories');
  try {
    const repos = await utils.accumulateValues(
      `./rest/api/1.0/repos?permission=REPO_WRITE&state=AVAILABLE`
    );
    const result = repos.map(
      (r: { project: { key: string }; slug: string }) =>
        `${r.project.key.toLowerCase()}/${r.slug}`
    );
    logger.debug({ result }, 'result of getRepos()');
    return result;
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, `bitbucket getRepos error`);
    throw err;
  }
}

export function cleanRepo() {
  logger.debug(`cleanRepo()`);
  if (config.storage) {
    config.storage.cleanRepo();
  }
  config = {} as any;
}

// Initialize GitLab by getting base branch
export async function initRepo({
  repository,
  gitPrivateKey,
  localDir,
  optimizeForDisabled,
  bbUseDefaultReviewers,
}: RepoParams) {
  logger.debug(
    `initRepo("${JSON.stringify({ repository, localDir }, null, 2)}")`
  );
  const opts = hostRules.find({
    hostType: defaults.hostType,
    url: defaults.endpoint,
  });

  const [projectKey, repositorySlug] = repository.split('/');

  if (optimizeForDisabled) {
    interface RenovateConfig {
      enabled: boolean;
    }

    interface FileData {
      isLastPage: boolean;

      lines: string[];

      size: number;
    }

    let renovateConfig: RenovateConfig;
    try {
      const { body } = await api.get<FileData>(
        `./rest/api/1.0/projects/${projectKey}/repos/${repositorySlug}/browse/renovate.json?limit=20000`
      );
      if (!body.isLastPage) logger.warn('Renovate config to big: ' + body.size);
      else renovateConfig = JSON.parse(body.lines.join());
    } catch {
      // Do nothing
    }
    if (renovateConfig && renovateConfig.enabled === false) {
      throw new Error('disabled');
    }
  }

  config = {
    projectKey,
    repositorySlug,
    gitPrivateKey,
    repository,
    prVersions: new Map<number, number>(),
    username: opts!.username,
  } as any;

  /* istanbul ignore else */
  if (bbUseDefaultReviewers !== false) {
    logger.debug('Enable bitbucket default reviewer');
    config.bbUseDefaultReviewers = true;
  }

  const { host, pathname } = url.parse(defaults.endpoint!);
  const gitUrl = GitStorage.getUrl({
    protocol: defaults.endpoint!.split(':')[0] as any,
    auth: `${opts!.username}:${opts!.password}`,
    host: `${host}${pathname}${
      pathname!.endsWith('/') ? '' : /* istanbul ignore next */ '/'
    }scm`,
    repository,
  });

  config.storage = new GitStorage();
  await config.storage.initRepo({
    ...config,
    localDir,
    url: gitUrl,
  });

  try {
    const info = (await api.get(
      `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}`
    )).body;
    config.owner = info.project.key;
    logger.debug(`${repository} owner = ${config.owner}`);
    config.defaultBranch = (await api.get(
      `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/branches/default`
    )).body.displayId;
    config.baseBranch = config.defaultBranch;
    config.mergeMethod = 'merge';
    const repoConfig: RepoConfig = {
      baseBranch: config.baseBranch,
      isFork: !!info.parent,
    };
    return repoConfig;
  } catch (err) /* istanbul ignore next */ {
    logger.debug(err);
    if (err.statusCode === 404) {
      throw new Error('not-found');
    }
    logger.info({ err }, 'Unknown Bitbucket initRepo error');
    throw err;
  }
}

export function getRepoForceRebase() {
  logger.debug(`getRepoForceRebase()`);
  // TODO if applicable
  // This function should return true only if the user has enabled a setting on the repo that enforces PRs to be kept up to date with master
  // In such cases we rebase Renovate branches every time they fall behind
  // In GitHub this is part of "branch protection"
  return false;
}

export async function setBaseBranch(branchName: string = config.defaultBranch) {
  config.baseBranch = branchName;
  await config.storage.setBaseBranch(branchName);
}

export /* istanbul ignore next */ function setBranchPrefix(
  branchPrefix: string
) {
  return config.storage.setBranchPrefix(branchPrefix);
}

// Search

// Get full file list
export function getFileList(branchName: string = config.baseBranch) {
  logger.debug(`getFileList(${branchName})`);
  return config.storage.getFileList(branchName);
}

// Branch

// Returns true if branch exists, otherwise false
export function branchExists(branchName: string) {
  logger.debug(`branchExists(${branchName})`);
  return config.storage.branchExists(branchName);
}

// Returns the Pull Request for a branch. Null if not exists.
export async function getBranchPr(branchName: string, refreshCache?: boolean) {
  logger.debug(`getBranchPr(${branchName})`);
  const existingPr = await findPr(branchName, undefined, 'open');
  return existingPr ? getPr(existingPr.number, refreshCache) : null;
}

export function getAllRenovateBranches(branchPrefix: string) {
  logger.debug('getAllRenovateBranches');
  return config.storage.getAllRenovateBranches(branchPrefix);
}

export function isBranchStale(branchName: string) {
  logger.debug(`isBranchStale(${branchName})`);
  return config.storage.isBranchStale(branchName);
}

export async function commitFilesToBranch(
  branchName: string,
  files: any[],
  message: string,
  parentBranch: string = config.baseBranch
) {
  logger.debug(
    `commitFilesToBranch(${JSON.stringify(
      { branchName, filesLength: files.length, message, parentBranch },
      null,
      2
    )})`
  );
  await config.storage.commitFilesToBranch(
    branchName,
    files,
    message,
    parentBranch
  );

  // wait for pr change propagation
  await delay(1000);
  // refresh cache
  await getBranchPr(branchName, true);
}

export function getFile(filePath: string, branchName: string) {
  logger.debug(`getFile(${filePath}, ${branchName})`);
  return config.storage.getFile(filePath, branchName);
}

export async function deleteBranch(branchName: string, closePr = false) {
  logger.debug(`deleteBranch(${branchName}, closePr=${closePr})`);
  // TODO: coverage
  // istanbul ignore next
  if (closePr) {
    // getBranchPr
    const pr = await getBranchPr(branchName);
    if (pr) {
      const { body } = await api.post(
        `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${pr.number}/decline?version=${pr.version}`
      );

      updatePrVersion(pr, body);
    }
  }
  return config.storage.deleteBranch(branchName);
}

export function mergeBranch(branchName: string) {
  logger.debug(`mergeBranch(${branchName})`);
  return config.storage.mergeBranch(branchName);
}

export function getBranchLastCommitTime(branchName: string) {
  logger.debug(`getBranchLastCommitTime(${branchName})`);
  return config.storage.getBranchLastCommitTime(branchName);
}

export /* istanbul ignore next */ function getRepoStatus() {
  return config.storage.getRepoStatus();
}

// Returns the combined status for a branch.
// umbrella for status checks
// https://docs.atlassian.com/bitbucket-server/rest/6.0.0/bitbucket-build-rest.html#idp2
export async function getBranchStatus(
  branchName: string,
  requiredStatusChecks?: string[] | boolean | null
) {
  logger.debug(
    `getBranchStatus(${branchName}, requiredStatusChecks=${!!requiredStatusChecks})`
  );

  if (!requiredStatusChecks) {
    // null means disable status checks, so it always succeeds
    logger.debug('Status checks disabled = returning "success"');
    return 'success';
  }

  if (!(await branchExists(branchName))) {
    throw new Error('repository-changed');
  }

  const branchCommit = await config.storage.getBranchCommit(branchName);

  try {
    const commitStatus = (await api.get(
      `./rest/build-status/1.0/commits/stats/${branchCommit}`
    )).body;

    logger.debug({ commitStatus }, 'branch status check result');

    if (commitStatus.failed > 0) return 'failed';
    if (commitStatus.inProgress > 0) return 'pending';
    return commitStatus.successful > 0 ? 'success' : 'pending';
  } catch (err) {
    logger.warn({ err }, `Failed to get branch status`);
    return 'failed';
  }
}

// https://docs.atlassian.com/bitbucket-server/rest/6.0.0/bitbucket-build-rest.html#idp2
export async function getBranchStatusCheck(
  branchName: string,
  context: string
) {
  logger.debug(`getBranchStatusCheck(${branchName}, context=${context})`);

  const branchCommit = await config.storage.getBranchCommit(branchName);

  try {
    const states = await utils.accumulateValues(
      `./rest/build-status/1.0/commits/${branchCommit}`
    );

    for (const state of states) {
      if (state.key === context) {
        switch (state.state) {
          case 'SUCCESSFUL':
            return 'success';
          case 'INPROGRESS':
            return 'pending';
          case 'FAILED':
          default:
            return 'failure';
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, `Failed to check branch status`);
  }
  return null;
}

export async function setBranchStatus(
  branchName: string,
  context: string,
  description: string,
  state: string | null,
  targetUrl?: string
) {
  logger.debug(`setBranchStatus(${branchName})`);

  const existingStatus = await getBranchStatusCheck(branchName, context);
  if (existingStatus === state) {
    return;
  }
  logger.info({ branch: branchName, context, state }, 'Setting branch status');

  const branchCommit = await config.storage.getBranchCommit(branchName);

  try {
    const body: any = {
      key: context,
      description,
      url: targetUrl || 'https://renovatebot.com',
    };

    switch (state) {
      case 'success':
        body.state = 'SUCCESSFUL';
        break;
      case 'pending':
        body.state = 'INPROGRESS';
        break;
      case 'failure':
      default:
        body.state = 'FAILED';
        break;
    }

    await api.post(`./rest/build-status/1.0/commits/${branchCommit}`, { body });
  } catch (err) {
    logger.warn({ err }, `Failed to set branch status`);
  }
}

// Issue

// function getIssueList() {
//   logger.debug(`getIssueList()`);
//   // TODO: Needs implementation
//   // This is used by Renovate when creating its own issues, e.g. for deprecated package warnings, config error notifications, or "masterIssue"
//   // BB Server doesnt have issues
//   return [];
// }

export /* istanbul ignore next */ function findIssue(title: string) {
  logger.debug(`findIssue(${title})`);
  // TODO: Needs implementation
  // This is used by Renovate when creating its own issues, e.g. for deprecated package warnings, config error notifications, or "masterIssue"
  // BB Server doesnt have issues
  return null;
}

export /* istanbul ignore next */ function ensureIssue(
  title: string,
  body: string
) {
  logger.warn({ title }, 'Cannot ensure issue');
  // TODO: Needs implementation
  // This is used by Renovate when creating its own issues, e.g. for deprecated package warnings, config error notifications, or "masterIssue"
  // BB Server doesnt have issues
  return null;
}

export /* istanbul ignore next */ function getIssueList() {
  logger.debug(`getIssueList()`);
  // TODO: Needs implementation
  return [];
}

export /* istanbul ignore next */ function ensureIssueClosing(title: string) {
  logger.debug(`ensureIssueClosing(${title})`);
  // TODO: Needs implementation
  // This is used by Renovate when creating its own issues, e.g. for deprecated package warnings, config error notifications, or "masterIssue"
  // BB Server doesnt have issues
}

// eslint-disable-next-line no-unused-vars
export function addAssignees(iid: number, assignees: string[]) {
  logger.debug(`addAssignees(${iid}, ${assignees})`);
  // TODO: Needs implementation
  // Currently Renovate does "Create PR" and then "Add assignee" as a two-step process, with this being the second step.
  // BB Server doesnt support assignees
}

export async function addReviewers(prNo: number, reviewers: string[]) {
  logger.debug(`Adding reviewers ${reviewers} to #${prNo}`);

  try {
    const pr = await getPr(prNo);
    if (!pr) {
      throw Object.assign(new Error('not-found'), { statusCode: 404 });
    }

    const reviewersSet = new Set([...pr.reviewers, ...reviewers]);

    await api.put(
      `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${prNo}`,
      {
        body: {
          title: pr.title,
          description: pr.description,
          version: pr.version,
          reviewers: Array.from(reviewersSet).map(name => ({ user: { name } })),
        },
      }
    );
    await getPr(prNo, true);
  } catch (err) {
    if (err.statusCode === 404) {
      throw new Error('not-found');
    } else if (err.statusCode === 409) {
      throw new Error('repository-changed');
    } else {
      logger.fatal({ err }, `Failed to add reviewers ${reviewers} to #${prNo}`);
      throw err;
    }
  }
}

// eslint-disable-next-line no-unused-vars
export function deleteLabel(issueNo: number, label: string) {
  logger.debug(`deleteLabel(${issueNo}, ${label})`);
  // TODO: Needs implementation
  // Only used for the "request Renovate to rebase a PR using a label" feature
}

async function getComments(prNo: number) {
  // GET /rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/activities
  let comments = await utils.accumulateValues(
    `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${prNo}/activities`
  );

  comments = comments
    .filter(
      (a: { action: string; commentAction: string }) =>
        a.action === 'COMMENTED' && a.commentAction === 'ADDED'
    )
    .map((a: { comment: string }) => a.comment);

  logger.debug(`Found ${comments.length} comments`);

  return comments;
}

async function addComment(prNo: number, text: string) {
  // POST /rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/comments
  await api.post(
    `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${prNo}/comments`,
    {
      body: { text },
    }
  );
}

async function getCommentVersion(prNo: number, commentId: number) {
  // GET /rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/comments/{commentId}
  const { version } = (await api.get(
    `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${prNo}/comments/${commentId}`
  )).body;

  return version;
}

async function editComment(prNo: number, commentId: number, text: string) {
  const version = await getCommentVersion(prNo, commentId);

  // PUT /rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/comments/{commentId}
  await api.put(
    `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${prNo}/comments/${commentId}`,
    {
      body: { text, version },
    }
  );
}

async function deleteComment(prNo: number, commentId: number) {
  const version = await getCommentVersion(prNo, commentId);

  // DELETE /rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/comments/{commentId}
  await api.delete(
    `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${prNo}/comments/${commentId}?version=${version}`
  );
}

export async function ensureComment(
  prNo: number,
  topic: string | null,
  rawContent: string
) {
  const content = sanitize(rawContent);
  try {
    const comments = await getComments(prNo);
    let body: string;
    let commentId: number | undefined;
    let commentNeedsUpdating: boolean | undefined;
    if (topic) {
      logger.debug(`Ensuring comment "${topic}" in #${prNo}`);
      body = `### ${topic}\n\n${content}`;
      comments.forEach((comment: { text: string; id: number }) => {
        if (comment.text.startsWith(`### ${topic}\n\n`)) {
          commentId = comment.id;
          commentNeedsUpdating = comment.text !== body;
        }
      });
    } else {
      logger.debug(`Ensuring content-only comment in #${prNo}`);
      body = `${content}`;
      comments.forEach((comment: { text: string; id: number }) => {
        if (comment.text === body) {
          commentId = comment.id;
          commentNeedsUpdating = false;
        }
      });
    }
    if (!commentId) {
      await addComment(prNo, body);
      logger.info(
        { repository: config.repository, prNo, topic },
        'Comment added'
      );
    } else if (commentNeedsUpdating) {
      await editComment(prNo, commentId, body);
      logger.info({ repository: config.repository, prNo }, 'Comment updated');
    } else {
      logger.debug('Comment is already update-to-date');
    }
    return true;
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error ensuring comment');
    return false;
  }
}

export async function ensureCommentRemoval(prNo: number, topic: string) {
  try {
    logger.debug(`Ensuring comment "${topic}" in #${prNo} is removed`);
    const comments = await getComments(prNo);
    let commentId;
    comments.forEach((comment: { text: string; id: any }) => {
      if (comment.text.startsWith(`### ${topic}\n\n`)) {
        commentId = comment.id;
      }
    });
    if (commentId) {
      await deleteComment(prNo, commentId);
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error ensuring comment removal');
  }
}

// TODO: coverage
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getPrList(_args?: any) {
  logger.debug(`getPrList()`);
  // istanbul ignore next
  if (!config.prList) {
    const query = new URLSearchParams({
      state: 'ALL',
      'role.1': 'AUTHOR',
      'username.1': config.username,
    }).toString();
    const values = await utils.accumulateValues(
      `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests?${query}`
    );

    config.prList = values.map(utils.prInfo);
    logger.info({ length: config.prList.length }, 'Retrieved Pull Requests');
  } else {
    logger.debug('returning cached PR list');
  }
  return config.prList;
}

// TODO: coverage
// istanbul ignore next
function matchesState(state: string, desiredState: string) {
  if (desiredState === 'all') {
    return true;
  }
  if (desiredState[0] === '!') {
    return state !== desiredState.substring(1);
  }
  return state === desiredState;
}

// TODO: coverage
// istanbul ignore next
const isRelevantPr = (
  branchName: string,
  prTitle: string | null | undefined,
  state: string
) => (p: { branchName: string; title: string; state: string }) =>
  p.branchName === branchName &&
  (!prTitle || p.title === prTitle) &&
  matchesState(p.state, state);

// TODO: coverage
// istanbul ignore next
export async function findPr(
  branchName: string,
  prTitle?: string,
  state = 'all',
  refreshCache?: boolean
) {
  logger.debug(`findPr(${branchName}, "${prTitle}", "${state}")`);
  const prList = await getPrList({ refreshCache });
  const pr = prList.find(isRelevantPr(branchName, prTitle, state));
  if (pr) {
    logger.debug(`Found PR #${pr.number}`);
  } else {
    logger.debug(`DID NOT Found PR from branch #${branchName}`);
  }
  return pr;
}

// Pull Request

export async function createPr(
  branchName: string,
  title: string,
  rawDescription: string,
  _labels?: string[] | null,
  useDefaultBranch?: boolean
) {
  const description = sanitize(rawDescription);
  logger.debug(`createPr(${branchName}, title=${title})`);
  const base = useDefaultBranch ? config.defaultBranch : config.baseBranch;
  let reviewers = [];

  /* istanbul ignore else */
  if (config.bbUseDefaultReviewers) {
    logger.debug(`fetching default reviewers`);
    const { id } = (await api.get(
      `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}`
    )).body;

    const defReviewers = (await api.get(
      `./rest/default-reviewers/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/reviewers?sourceRefId=refs/heads/${branchName}&targetRefId=refs/heads/${base}&sourceRepoId=${id}&targetRepoId=${id}`
    )).body;

    reviewers = defReviewers.map((u: { name: string }) => ({
      user: { name: u.name },
    }));
  }

  const body = {
    title,
    description,
    fromRef: {
      id: `refs/heads/${branchName}`,
    },
    toRef: {
      id: `refs/heads/${base}`,
    },
    reviewers,
  };
  let prInfoRes;
  try {
    prInfoRes = await api.post(
      `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests`,
      { body }
    );
  } catch (err) /* istanbul ignore next */ {
    if (
      err.body &&
      err.body.errors &&
      err.body.errors.length &&
      err.body.errors[0].exceptionName ===
        'com.atlassian.bitbucket.pull.EmptyPullRequestException'
    ) {
      logger.info(
        'Empty pull request - deleting branch so it can be recreated next run'
      );
      await deleteBranch(branchName);
      throw new Error('repository-changed');
    }
    throw err;
  }

  const pr = {
    id: prInfoRes.body.id,
    displayNumber: `Pull Request #${prInfoRes.body.id}`,
    isModified: false,
    ...utils.prInfo(prInfoRes.body),
  };

  updatePrVersion(pr.number, pr.version);

  // istanbul ignore if
  if (config.prList) {
    config.prList.push(pr);
  }

  return pr;
}

// Gets details for a PR
export async function getPr(prNo: number, refreshCache?: boolean) {
  logger.debug(`getPr(${prNo})`);
  if (!prNo) {
    return null;
  }

  const res = await api.get(
    `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${prNo}`,
    { useCache: !refreshCache }
  );

  const pr: any = {
    displayNumber: `Pull Request #${res.body.id}`,
    ...utils.prInfo(res.body),
    reviewers: res.body.reviewers.map(
      (r: { user: { name: any } }) => r.user.name
    ),
    isModified: false,
  };

  pr.version = updatePrVersion(pr.number, pr.version);

  if (pr.state === 'open') {
    const mergeRes = await api.get(
      `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${prNo}/merge`,
      { useCache: !refreshCache }
    );
    pr.isConflicted = !!mergeRes.body.conflicted;
    pr.canMerge = !!mergeRes.body.canMerge;

    const prCommits = (await api.get(
      `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${prNo}/commits?withCounts=true`,
      { useCache: !refreshCache }
    )).body;

    if (prCommits.totalCount === 1) {
      if (global.gitAuthor) {
        const commitAuthorEmail = prCommits.values[0].author.emailAddress;
        if (commitAuthorEmail !== global.gitAuthor.email) {
          logger.debug(
            { prNo },
            'PR is modified: 1 commit but not by configured gitAuthor'
          );
          pr.isModified = true;
        }
      }
    } else {
      logger.debug(
        { prNo },
        `PR is modified: Found ${prCommits.totalCount} commits`
      );
      pr.isModified = true;
    }
  }

  if (await branchExists(pr.branchName)) {
    pr.isStale = await isBranchStale(pr.branchName);
  }

  return pr;
}

// Return a list of all modified files in a PR
// https://docs.atlassian.com/bitbucket-server/rest/6.0.0/bitbucket-rest.html
export async function getPrFiles(prNo: number) {
  logger.debug(`getPrFiles(${prNo})`);
  if (!prNo) {
    return [];
  }

  // GET /rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/changes
  const values = await utils.accumulateValues(
    `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${prNo}/changes?withComments=false`
  );
  return values.map((f: { path: string }) => f.path.toString);
}

export async function updatePr(
  prNo: number,
  title: string,
  rawDescription: string
) {
  const description = sanitize(rawDescription);
  logger.debug(`updatePr(${prNo}, title=${title})`);

  try {
    const pr = await getPr(prNo);
    if (!pr) {
      throw Object.assign(new Error('not-found'), { statusCode: 404 });
    }

    const { body } = await api.put(
      `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${prNo}`,
      {
        body: {
          title,
          description,
          version: pr.version,
          reviewers: pr.reviewers.map((name: string) => ({ user: { name } })),
        },
      }
    );

    updatePrVersion(prNo, body.version);
  } catch (err) {
    if (err.statusCode === 404) {
      throw new Error('not-found');
    } else if (err.statusCode === 409) {
      throw new Error('repository-changed');
    } else {
      logger.fatal({ err }, `Failed to update PR`);
      throw err;
    }
  }
}

// https://docs.atlassian.com/bitbucket-server/rest/6.0.0/bitbucket-rest.html#idp261
export async function mergePr(prNo: number, branchName: string) {
  logger.debug(`mergePr(${prNo}, ${branchName})`);
  // Used for "automerge" feature
  try {
    const pr = await getPr(prNo);
    if (!pr) {
      throw Object.assign(new Error('not-found'), { statusCode: 404 });
    }
    const { body } = await api.post(
      `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${prNo}/merge?version=${pr.version}`
    );
    updatePrVersion(prNo, body.version);
  } catch (err) {
    if (err.statusCode === 404) {
      throw new Error('not-found');
    } else if (err.statusCode === 409) {
      logger.warn({ err }, `Failed to merge PR`);
      return false;
    } else {
      logger.warn({ err }, `Failed to merge PR`);
      return false;
    }
  }

  logger.debug({ pr: prNo }, 'PR merged');
  // Delete branch
  await deleteBranch(branchName);
  return true;
}

export function getPrBody(input: string) {
  logger.debug(`getPrBody(${input.split('\n')[0]})`);
  // Remove any HTML we use
  return smartTruncate(input, 30000)
    .replace(/<\/?summary>/g, '**')
    .replace(/<\/?details>/g, '')
    .replace(new RegExp(`\n---\n\n.*?<!-- .*?-rebase -->.*?(\n|$)`), '')
    .replace(new RegExp('<!--.*?-->', 'g'), '');
}

export function getCommitMessages() {
  logger.debug(`getCommitMessages()`);
  return config.storage.getCommitMessages();
}

export function getVulnerabilityAlerts() {
  logger.debug(`getVulnerabilityAlerts()`);
  return [];
}
