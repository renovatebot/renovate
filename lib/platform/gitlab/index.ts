import URL, { URLSearchParams } from 'url';
import is from '@sindresorhus/is';

import { api } from './gl-got-wrapper';
import * as hostRules from '../../util/host-rules';
import GitStorage, { StatusResult, CommitFilesConfig } from '../git/storage';
import {
  PlatformConfig,
  RepoParams,
  RepoConfig,
  GotResponse,
  Pr,
  Issue,
  VulnerabilityAlert,
  CreatePRConfig,
  EnsureIssueConfig,
  BranchStatusConfig,
} from '../common';
import { configFileNames } from '../../config/app-strings';
import { logger } from '../../logger';
import { sanitize } from '../../util/sanitize';
import { smartTruncate } from '../utils/pr-body';
import { RenovateConfig } from '../../config';
import {
  PLATFORM_AUTHENTICATION_ERROR,
  REPOSITORY_ACCESS_FORBIDDEN,
  REPOSITORY_ARCHIVED,
  REPOSITORY_CHANGED,
  REPOSITORY_DISABLED,
  REPOSITORY_EMPTY,
  REPOSITORY_MIRRORED,
  REPOSITORY_NOT_FOUND,
} from '../../constants/error-messages';

const defaultConfigFile = configFileNames[0];
let config: {
  storage: GitStorage;
  gitPrivateKey?: string;
  repository: string;
  localDir: string;
  defaultBranch: string;
  baseBranch: string;
  email: string;
  prList: any[];
  issueList: any[];
  optimizeForDisabled: boolean;
} = {} as any;

const defaults = {
  hostType: 'gitlab',
  endpoint: 'https://gitlab.com/api/v4/',
};

let authorId: number;

export async function initPlatform({
  endpoint,
  token,
}: {
  token: string;
  endpoint: string;
}): Promise<PlatformConfig> {
  if (!token) {
    throw new Error('Init: You must configure a GitLab personal access token');
  }
  if (endpoint) {
    defaults.endpoint = endpoint.replace(/\/?$/, '/'); // always add a trailing slash
    api.setBaseUrl(defaults.endpoint);
  } else {
    logger.info('Using default GitLab endpoint: ' + defaults.endpoint);
  }
  let gitAuthor: string;
  try {
    const user = (await api.get(`user`, { token })).body;
    gitAuthor = `${user.name} <${user.email}>`;
    authorId = user.id;
  } catch (err) {
    logger.info(
      { err },
      'Error authenticating with GitLab. Check that your token includes "user" permissions'
    );
    throw new Error('Init: Authentication failure');
  }
  const platformConfig: PlatformConfig = {
    endpoint: defaults.endpoint,
    gitAuthor,
  };
  return platformConfig;
}

// Get all repositories that the user has access to
export async function getRepos(): Promise<string[]> {
  logger.info('Autodiscovering GitLab repositories');
  try {
    const url = `projects?membership=true&per_page=100&with_merge_requests_enabled=true`;
    const res = await api.get(url, { paginate: true });
    logger.info(`Discovered ${res.body.length} project(s)`);
    return res.body.map(
      (repo: { path_with_namespace: string }) => repo.path_with_namespace
    );
  } catch (err) {
    logger.error({ err }, `GitLab getRepos error`);
    throw err;
  }
}

function urlEscape(str: string): string {
  return str ? str.replace(/\//g, '%2F') : str;
}

export function cleanRepo(): void {
  // istanbul ignore if
  if (config.storage) {
    config.storage.cleanRepo();
  }
  // In theory most of this isn't necessary. In practice..
  config = {} as any;
}

// Initialize GitLab by getting base branch
export async function initRepo({
  repository,
  gitPrivateKey,
  localDir,
  optimizeForDisabled,
}: RepoParams): Promise<RepoConfig> {
  config = {} as any;
  config.repository = urlEscape(repository);
  config.gitPrivateKey = gitPrivateKey;
  config.localDir = localDir;
  let res: GotResponse<{
    archived: boolean;
    mirror: boolean;
    default_branch: string;
    empty_repo: boolean;
    http_url_to_repo: string;
    forked_from_project: boolean;
    repository_access_level: 'disabled' | 'private' | 'enabled';
    merge_requests_access_level: 'disabled' | 'private' | 'enabled';
  }>;
  try {
    res = await api.get(`projects/${config.repository}`);
    if (res.body.archived) {
      logger.info(
        'Repository is archived - throwing error to abort renovation'
      );
      throw new Error(REPOSITORY_ARCHIVED);
    }
    if (res.body.mirror) {
      logger.info(
        'Repository is a mirror - throwing error to abort renovation'
      );
      throw new Error(REPOSITORY_MIRRORED);
    }
    if (res.body.repository_access_level === 'disabled') {
      logger.info(
        'Repository portion of project is disabled - throwing error to abort renovation'
      );
      throw new Error(REPOSITORY_DISABLED);
    }
    if (res.body.merge_requests_access_level === 'disabled') {
      logger.info(
        'MRs are disabled for the project - throwing error to abort renovation'
      );
      throw new Error(REPOSITORY_DISABLED);
    }
    if (res.body.default_branch === null || res.body.empty_repo) {
      throw new Error(REPOSITORY_EMPTY);
    }
    if (optimizeForDisabled) {
      let renovateConfig: RenovateConfig;
      try {
        renovateConfig = JSON.parse(
          Buffer.from(
            (await api.get(
              `projects/${config.repository}/repository/files/${defaultConfigFile}?ref=${res.body.default_branch}`
            )).body.content,
            'base64'
          ).toString()
        );
      } catch (err) {
        // Do nothing
      }
      if (renovateConfig && renovateConfig.enabled === false) {
        throw new Error(REPOSITORY_DISABLED);
      }
    }
    config.defaultBranch = res.body.default_branch;
    config.baseBranch = config.defaultBranch;
    logger.debug(`${repository} default branch = ${config.baseBranch}`);
    // Discover our user email
    config.email = (await api.get(`user`)).body.email;
    logger.debug('Bot email=' + config.email);
    delete config.prList;
    logger.debug('Enabling Git FS');
    const opts = hostRules.find({
      hostType: defaults.hostType,
      url: defaults.endpoint,
    });
    let url: string;
    if (res.body.http_url_to_repo === null) {
      logger.debug('no http_url_to_repo found. Falling back to old behaviour.');
      const { host, protocol } = URL.parse(defaults.endpoint);
      url = GitStorage.getUrl({
        protocol: protocol!.slice(0, -1) as any,
        auth: 'oauth2:' + opts.token,
        host,
        repository,
      });
    } else {
      logger.debug(`${repository} http URL = ${res.body.http_url_to_repo}`);
      const repoUrl = URL.parse(`${res.body.http_url_to_repo}`);
      repoUrl.auth = 'oauth2:' + opts.token;
      url = URL.format(repoUrl);
    }
    config.storage = new GitStorage();
    await config.storage.initRepo({
      ...config,
      url,
    });
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err }, 'Caught initRepo error');
    if (err.message.includes('HEAD is not a symbolic ref')) {
      throw new Error(REPOSITORY_EMPTY);
    }
    if (['archived', 'empty'].includes(err.message)) {
      throw err;
    }
    if (err.statusCode === 403) {
      throw new Error(REPOSITORY_ACCESS_FORBIDDEN);
    }
    if (err.statusCode === 404) {
      throw new Error(REPOSITORY_NOT_FOUND);
    }
    if (err.message === REPOSITORY_DISABLED) {
      throw err;
    }
    logger.info({ err }, 'Unknown GitLab initRepo error');
    throw err;
  }
  const repoConfig: RepoConfig = {
    baseBranch: config.baseBranch,
    isFork: !!res.body.forked_from_project,
  };
  return repoConfig;
}

export function getRepoForceRebase(): boolean {
  return false;
}

export async function setBaseBranch(
  branchName = config.baseBranch
): Promise<void> {
  logger.debug(`Setting baseBranch to ${branchName}`);
  config.baseBranch = branchName;
  await config.storage.setBaseBranch(branchName);
}

export /* istanbul ignore next */ function setBranchPrefix(
  branchPrefix: string
): Promise<void> {
  return config.storage.setBranchPrefix(branchPrefix);
}

// Search

// Get full file list
export function getFileList(branchName = config.baseBranch): Promise<string[]> {
  return config.storage.getFileList(branchName);
}

// Returns true if branch exists, otherwise false
export function branchExists(branchName: string): Promise<boolean> {
  return config.storage.branchExists(branchName);
}

type BranchState = 'pending' | 'running' | 'success' | 'failed' | 'canceled';

interface BranchStatus {
  status: BranchState;
  name: string;
  allow_failure?: boolean;
}

async function getStatus(
  branchName: string,
  useCache = true
): Promise<BranchStatus[]> {
  const branchSha = await config.storage.getBranchCommit(branchName);
  const url = `projects/${config.repository}/repository/commits/${branchSha}/statuses`;

  return (await api.get(url, { paginate: true, useCache })).body;
}

// Returns the combined status for a branch.
export async function getBranchStatus(
  branchName: string,
  requiredStatusChecks?: string[] | null
): Promise<string> {
  logger.debug(`getBranchStatus(${branchName})`);
  if (!requiredStatusChecks) {
    // null means disable status checks, so it always succeeds
    return 'success';
  }
  if (Array.isArray(requiredStatusChecks) && requiredStatusChecks.length) {
    // This is Unsupported
    logger.warn({ requiredStatusChecks }, `Unsupported requiredStatusChecks`);
    return 'failed';
  }

  if (!(await branchExists(branchName))) {
    throw new Error(REPOSITORY_CHANGED);
  }

  const res = await getStatus(branchName);
  logger.debug(`Got res with ${res.length} results`);
  if (res.length === 0) {
    // Return 'pending' if we have no status checks
    return 'pending';
  }
  let status = 'success';
  // Return 'success' if all are success
  res.forEach(check => {
    // If one is failed then don't overwrite that
    if (status !== 'failure') {
      if (!check.allow_failure) {
        if (check.status === 'failed') {
          status = 'failure';
        } else if (check.status !== 'success') {
          ({ status } = check);
        }
      }
    }
  });
  return status;
}

// Pull Request

export async function createPr({
  branchName,
  prTitle: title,
  prBody: rawDescription,
  labels,
  useDefaultBranch,
  platformOptions,
}: CreatePRConfig): Promise<Pr> {
  const description = sanitize(rawDescription);
  const targetBranch = useDefaultBranch
    ? config.defaultBranch
    : config.baseBranch;
  logger.debug(`Creating Merge Request: ${title}`);
  const res = await api.post(`projects/${config.repository}/merge_requests`, {
    body: {
      source_branch: branchName,
      target_branch: targetBranch,
      remove_source_branch: true,
      title,
      description,
      labels: is.array(labels) ? labels.join(',') : null,
    },
  });
  const pr = res.body;
  pr.number = pr.iid;
  pr.branchName = branchName;
  pr.displayNumber = `Merge Request #${pr.iid}`;
  pr.isModified = false;
  // istanbul ignore if
  if (config.prList) {
    config.prList.push(pr);
  }
  if (platformOptions && platformOptions.gitLabAutomerge) {
    try {
      await api.put(
        `projects/${config.repository}/merge_requests/${pr.iid}/merge`,
        {
          body: {
            should_remove_source_branch: true,
            merge_when_pipeline_succeeds: true,
          },
        }
      );
    } catch (err) /* istanbul ignore next */ {
      logger.debug({ err }, 'Automerge on PR creation failed');
    }
  }

  return pr;
}

export async function getPr(iid: number): Promise<Pr> {
  logger.debug(`getPr(${iid})`);
  const url = `projects/${config.repository}/merge_requests/${iid}?include_diverged_commits_count=1`;
  const pr = (await api.get(url)).body;
  // Harmonize fields with GitHub
  pr.branchName = pr.source_branch;
  pr.targetBranch = pr.target_branch;
  pr.number = pr.iid;
  pr.displayNumber = `Merge Request #${pr.iid}`;
  pr.body = pr.description;
  pr.isStale = pr.diverged_commits_count > 0;
  pr.state = pr.state === 'opened' ? 'open' : pr.state;
  pr.isModified = true;
  if (pr.merge_status === 'cannot_be_merged') {
    logger.debug('pr cannot be merged');
    pr.canMerge = false;
    pr.isConflicted = true;
  } else if (pr.state === 'open') {
    const branchStatus = await getBranchStatus(pr.branchName, []);
    if (branchStatus === 'success') {
      pr.canMerge = true;
    }
  }
  // Check if the most recent branch commit is by us
  // If not then we don't allow it to be rebased, in case someone's changes would be lost
  const branchUrl = `projects/${
    config.repository
  }/repository/branches/${urlEscape(pr.source_branch)}`;
  try {
    const branch = (await api.get(branchUrl)).body;
    const branchCommitEmail =
      branch && branch.commit ? branch.commit.author_email : null;
    // istanbul ignore if
    if (branchCommitEmail === config.email) {
      pr.isModified = false;
    } else {
      logger.debug(
        { branchCommitEmail, configEmail: config.email, iid: pr.iid },
        'Last committer to branch does not match bot email, so PR cannot be rebased.'
      );
      pr.isModified = true;
    }
  } catch (err) {
    logger.debug({ err }, 'Error getting PR branch');
    if (pr.state === 'open' || err.statusCode !== 404) {
      logger.warn({ err }, 'Error getting PR branch');
      pr.isConflicted = true;
    }
  }
  return pr;
}

// Return a list of all modified files in a PR
export async function getPrFiles(mrNo: number): Promise<string[]> {
  logger.debug({ mrNo }, 'getPrFiles');
  if (!mrNo) {
    return [];
  }
  const files = (await api.get(
    `projects/${config.repository}/merge_requests/${mrNo}/changes`
  )).body.changes;
  return files.map((f: { new_path: string }) => f.new_path);
}

// istanbul ignore next
async function closePr(iid: number): Promise<void> {
  await api.put(`projects/${config.repository}/merge_requests/${iid}`, {
    body: {
      state_event: 'close',
    },
  });
}

export async function updatePr(
  iid: number,
  title: string,
  description: string
): Promise<void> {
  await api.put(`projects/${config.repository}/merge_requests/${iid}`, {
    body: {
      title,
      description: sanitize(description),
    },
  });
}

export async function mergePr(iid: number): Promise<boolean> {
  try {
    await api.put(`projects/${config.repository}/merge_requests/${iid}/merge`, {
      body: {
        should_remove_source_branch: true,
      },
    });
    return true;
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 401) {
      logger.info('No permissions to merge PR');
      return false;
    }
    if (err.statusCode === 406) {
      logger.info('PR not acceptable for merging');
      return false;
    }
    logger.debug({ err }, 'merge PR error');
    logger.info('PR merge failed');
    return false;
  }
}

export function getPrBody(input: string): string {
  return smartTruncate(
    input
      .replace(/Pull Request/g, 'Merge Request')
      .replace(/PR/g, 'MR')
      .replace(/\]\(\.\.\/pull\//g, '](../merge_requests/'),
    1000000
  );
}

// Branch

// Returns the Pull Request for a branch. Null if not exists.
export async function getBranchPr(branchName: string): Promise<Pr> {
  logger.debug(`getBranchPr(${branchName})`);
  // istanbul ignore if
  if (!(await branchExists(branchName))) {
    return null;
  }
  const query = new URLSearchParams({
    per_page: '100',
    state: 'opened',
    source_branch: branchName,
  }).toString();
  const urlString = `projects/${config.repository}/merge_requests?${query}`;
  const res = await api.get(urlString, { paginate: true });
  logger.debug(`Got res with ${res.body.length} results`);
  let pr: any = null;
  res.body.forEach((result: { source_branch: string }) => {
    if (result.source_branch === branchName) {
      pr = result;
    }
  });
  if (!pr) {
    return null;
  }
  return getPr(pr.iid);
}

export function getAllRenovateBranches(
  branchPrefix: string
): Promise<string[]> {
  return config.storage.getAllRenovateBranches(branchPrefix);
}

export function isBranchStale(branchName: string): Promise<boolean> {
  return config.storage.isBranchStale(branchName);
}

export function commitFilesToBranch({
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

export function getFile(
  filePath: string,
  branchName?: string
): Promise<string> {
  return config.storage.getFile(filePath, branchName);
}

export async function deleteBranch(
  branchName: string,
  shouldClosePr = false
): Promise<void> {
  if (shouldClosePr) {
    logger.debug('Closing PR');
    const pr = await getBranchPr(branchName);
    // istanbul ignore if
    if (pr) {
      await closePr(pr.number);
    }
  }
  return config.storage.deleteBranch(branchName);
}

export function mergeBranch(branchName: string): Promise<void> {
  return config.storage.mergeBranch(branchName);
}

export function getBranchLastCommitTime(branchName: string): Promise<Date> {
  return config.storage.getBranchLastCommitTime(branchName);
}

// istanbul ignore next
export function getRepoStatus(): Promise<StatusResult> {
  return config.storage.getRepoStatus();
}

export async function getBranchStatusCheck(
  branchName: string,
  context: string
): Promise<string | null> {
  // cache-bust in case we have rebased
  const res = await getStatus(branchName, false);
  logger.debug(`Got res with ${res.length} results`);
  for (const check of res) {
    if (check.name === context) {
      return check.status;
    }
  }
  return null;
}

export async function setBranchStatus({
  branchName,
  context,
  description,
  state,
  url: targetUrl,
}: BranchStatusConfig): Promise<void> {
  // First, get the branch commit SHA
  const branchSha = await config.storage.getBranchCommit(branchName);
  // Now, check the statuses for that commit
  const url = `projects/${config.repository}/statuses/${branchSha}`;
  const options: any = {
    state: state.replace('failure', 'failed'), // GitLab uses 'failed', not 'failure'
    description,
    context,
  };
  if (targetUrl) {
    options.target_url = targetUrl;
  }
  try {
    await api.post(url, { body: options });

    // update status cache
    await getStatus(branchName, false);
  } catch (err) /* istanbul ignore next */ {
    if (
      err.body &&
      err.body.message &&
      err.body.message.startsWith(
        'Cannot transition status via :enqueue from :pending'
      )
    ) {
      // https://gitlab.com/gitlab-org/gitlab-foss/issues/25807
      logger.info('Ignoring status transition error');
    } else {
      logger.debug({ err });
      logger.warn('Failed to set branch status');
    }
  }
}

// Issue

export async function getIssueList(): Promise<any[]> {
  if (!config.issueList) {
    const res = await api.get(
      `projects/${config.repository}/issues?state=opened`,
      {
        useCache: false,
      }
    );
    // istanbul ignore if
    if (!is.array(res.body)) {
      logger.warn({ responseBody: res.body }, 'Could not retrieve issue list');
      return [];
    }
    config.issueList = res.body.map((i: { iid: number; title: string }) => ({
      iid: i.iid,
      title: i.title,
    }));
  }
  return config.issueList;
}

export async function findIssue(title: string): Promise<Issue | null> {
  logger.debug(`findIssue(${title})`);
  try {
    const issueList = await getIssueList();
    const issue = issueList.find((i: { title: string }) => i.title === title);
    if (!issue) {
      return null;
    }
    const issueBody = (await api.get(
      `projects/${config.repository}/issues/${issue.iid}`
    )).body.description;
    return {
      number: issue.iid,
      body: issueBody,
    };
  } catch (err) /* istanbul ignore next */ {
    logger.warn('Error finding issue');
    return null;
  }
}

export async function ensureIssue({
  title,
  body,
}: EnsureIssueConfig): Promise<'updated' | 'created' | null> {
  logger.debug(`ensureIssue()`);
  const description = getPrBody(sanitize(body));
  try {
    const issueList = await getIssueList();
    const issue = issueList.find((i: { title: string }) => i.title === title);
    if (issue) {
      const existingDescription = (await api.get(
        `projects/${config.repository}/issues/${issue.iid}`
      )).body.description;
      if (existingDescription !== description) {
        logger.debug('Updating issue body');
        await api.put(`projects/${config.repository}/issues/${issue.iid}`, {
          body: { description },
        });
        return 'updated';
      }
    } else {
      await api.post(`projects/${config.repository}/issues`, {
        body: {
          title,
          description,
        },
      });
      // delete issueList so that it will be refetched as necessary
      delete config.issueList;
      return 'created';
    }
  } catch (err) /* istanbul ignore next */ {
    if (err.message.startsWith('Issues are disabled for this repo')) {
      logger.info(`Could not create issue: ${err.message}`);
    } else {
      logger.warn({ err }, 'Could not ensure issue');
    }
  }
  return null;
}

export async function ensureIssueClosing(title: string): Promise<void> {
  logger.debug(`ensureIssueClosing()`);
  const issueList = await getIssueList();
  for (const issue of issueList) {
    if (issue.title === title) {
      logger.info({ issue }, 'Closing issue');
      await api.put(`projects/${config.repository}/issues/${issue.iid}`, {
        body: { state_event: 'close' },
      });
    }
  }
}

export async function addAssignees(
  iid: number,
  assignees: string[]
): Promise<void> {
  logger.debug(`Adding assignees ${assignees} to #${iid}`);
  try {
    let assigneeId = (await api.get(`users?username=${assignees[0]}`)).body[0]
      .id;
    let url = `projects/${config.repository}/merge_requests/${iid}?assignee_id=${assigneeId}`;
    await api.put(url);
    try {
      if (assignees.length > 1) {
        url = `projects/${config.repository}/merge_requests/${iid}?assignee_ids[]=${assigneeId}`;
        for (let i = 1; i < assignees.length; i += 1) {
          assigneeId = (await api.get(`users?username=${assignees[i]}`)).body[0]
            .id;
          url += `&assignee_ids[]=${assigneeId}`;
        }
        await api.put(url);
      }
    } catch (error) {
      logger.error({ iid, assignees }, 'Failed to add multiple assignees');
    }
  } catch (err) {
    logger.error({ iid, assignees }, 'Failed to add assignees');
  }
}

export function addReviewers(iid: number, reviewers: string[]): void {
  logger.debug(`addReviewers('${iid}, '${reviewers})`);
  logger.warn('Unimplemented in GitLab: approvals');
}

export async function deleteLabel(
  issueNo: number,
  label: string
): Promise<void> {
  logger.debug(`Deleting label ${label} from #${issueNo}`);
  try {
    const pr = await getPr(issueNo);
    const labels = (pr.labels || []).filter((l: string) => l !== label).join();
    await api.put(`projects/${config.repository}/merge_requests/${issueNo}`, {
      body: { labels },
    });
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err, issueNo, label }, 'Failed to delete label');
  }
}

async function getComments(issueNo: number): Promise<any[]> {
  // GET projects/:owner/:repo/merge_requests/:number/notes
  logger.debug(`Getting comments for #${issueNo}`);
  const url = `projects/${config.repository}/merge_requests/${issueNo}/notes`;
  const comments = (await api.get(url, { paginate: true })).body;
  logger.debug(`Found ${comments.length} comments`);
  return comments;
}

async function addComment(issueNo: number, body: string): Promise<void> {
  // POST projects/:owner/:repo/merge_requests/:number/notes
  await api.post(
    `projects/${config.repository}/merge_requests/${issueNo}/notes`,
    {
      body: { body },
    }
  );
}

async function editComment(
  issueNo: number,
  commentId: number,
  body: string
): Promise<void> {
  // PUT projects/:owner/:repo/merge_requests/:number/notes/:id
  await api.put(
    `projects/${config.repository}/merge_requests/${issueNo}/notes/${commentId}`,
    {
      body: { body },
    }
  );
}

async function deleteComment(
  issueNo: number,
  commentId: number
): Promise<void> {
  // DELETE projects/:owner/:repo/merge_requests/:number/notes/:id
  await api.delete(
    `projects/${config.repository}/merge_requests/${issueNo}/notes/${commentId}`
  );
}

export async function ensureComment(
  issueNo: number,
  topic: string | null | undefined,
  rawContent: string
): Promise<void> {
  const content = sanitize(rawContent);
  const massagedTopic = topic
    ? topic.replace(/Pull Request/g, 'Merge Request').replace(/PR/g, 'MR')
    : topic;
  const comments = await getComments(issueNo);
  let body: string;
  let commentId;
  let commentNeedsUpdating;
  if (topic) {
    logger.debug(`Ensuring comment "${massagedTopic}" in #${issueNo}`);
    body = `### ${topic}\n\n${content}`;
    body = body.replace(/Pull Request/g, 'Merge Request').replace(/PR/g, 'MR');
    comments.forEach((comment: { body: string; id: number }) => {
      if (comment.body.startsWith(`### ${massagedTopic}\n\n`)) {
        commentId = comment.id;
        commentNeedsUpdating = comment.body !== body;
      }
    });
  } else {
    logger.debug(`Ensuring content-only comment in #${issueNo}`);
    body = `${content}`;
    comments.forEach((comment: { body: string; id: number }) => {
      if (comment.body === body) {
        commentId = comment.id;
        commentNeedsUpdating = false;
      }
    });
  }
  if (!commentId) {
    await addComment(issueNo, body);
    logger.info({ repository: config.repository, issueNo }, 'Added comment');
  } else if (commentNeedsUpdating) {
    await editComment(issueNo, commentId, body);
    logger.info({ repository: config.repository, issueNo }, 'Updated comment');
  } else {
    logger.debug('Comment is already update-to-date');
  }
}

export async function ensureCommentRemoval(
  issueNo: number,
  topic: string
): Promise<void> {
  logger.debug(`Ensuring comment "${topic}" in #${issueNo} is removed`);
  const comments = await getComments(issueNo);
  let commentId;
  comments.forEach((comment: { body: string; id: number }) => {
    if (comment.body.startsWith(`### ${topic}\n\n`)) {
      commentId = comment.id;
    }
  });
  if (commentId) {
    await deleteComment(issueNo, commentId);
  }
}

const mapPullRequests = (pr: {
  iid: number;
  source_branch: string;
  title: string;
  state: string;
  created_at: string;
}): Pr => ({
  number: pr.iid,
  branchName: pr.source_branch,
  title: pr.title,
  state: pr.state === 'opened' ? 'open' : pr.state,
  createdAt: pr.created_at,
});

async function fetchPrList(): Promise<Pr[]> {
  const query = new URLSearchParams({
    per_page: '100',
    author_id: `${authorId}`,
  }).toString();
  const urlString = `projects/${config.repository}/merge_requests?${query}`;
  try {
    const res = await api.get(urlString, { paginate: true });
    return res.body.map(mapPullRequests);
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err }, 'Error fetching PR list');
    if (err.statusCode === 403) {
      throw new Error(PLATFORM_AUTHENTICATION_ERROR);
    }
    throw err;
  }
}

export async function getPrList(): Promise<Pr[]> {
  if (!config.prList) {
    config.prList = await fetchPrList();
  }
  return config.prList;
}

function matchesState(state: string, desiredState: string): boolean {
  if (desiredState === 'all') {
    return true;
  }
  if (desiredState[0] === '!') {
    return state !== desiredState.substring(1);
  }
  return state === desiredState;
}

export async function findPr(
  branchName: string,
  prTitle?: string | null,
  state = 'all'
): Promise<Pr> {
  logger.debug(`findPr(${branchName}, ${prTitle}, ${state})`);
  const prList = await getPrList();
  return prList.find(
    (p: { branchName: string; title: string; state: string }) =>
      p.branchName === branchName &&
      (!prTitle || p.title === prTitle) &&
      matchesState(p.state, state)
  );
}

export function getCommitMessages(): Promise<string[]> {
  return config.storage.getCommitMessages();
}

export function getVulnerabilityAlerts(): VulnerabilityAlert[] {
  return [];
}
