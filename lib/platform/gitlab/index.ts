import URL, { URLSearchParams } from 'url';
import is from '@sindresorhus/is';

import delay from 'delay';
import { configFileNames } from '../../config/app-strings';
import { RenovateConfig } from '../../config/common';
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
import { PLATFORM_TYPE_GITLAB } from '../../constants/platforms';
import { PR_STATE_ALL, PR_STATE_OPEN } from '../../constants/pull-requests';
import { logger } from '../../logger';
import { BranchStatus } from '../../types';
import * as git from '../../util/git';
import * as hostRules from '../../util/host-rules';
import { HttpResponse } from '../../util/http';
import { GitlabHttp, setBaseUrl } from '../../util/http/gitlab';
import { sanitize } from '../../util/sanitize';
import { ensureTrailingSlash } from '../../util/url';
import {
  BranchStatusConfig,
  CreatePRConfig,
  EnsureCommentConfig,
  EnsureCommentRemovalConfig,
  EnsureIssueConfig,
  FindPRConfig,
  Issue,
  PlatformConfig,
  Pr,
  RepoConfig,
  RepoParams,
  VulnerabilityAlert,
} from '../common';
import { smartTruncate } from '../utils/pr-body';

const gitlabApi = new GitlabHttp();

type MergeMethod = 'merge' | 'rebase_merge' | 'ff';
type RepoResponse = {
  archived: boolean;
  mirror: boolean;
  default_branch: string;
  empty_repo: boolean;
  http_url_to_repo: string;
  forked_from_project: boolean;
  repository_access_level: 'disabled' | 'private' | 'enabled';
  merge_requests_access_level: 'disabled' | 'private' | 'enabled';
  merge_method: MergeMethod;
  path_with_namespace: string;
};
const defaultConfigFile = configFileNames[0];
let config: {
  repository: string;
  localDir: string;
  defaultBranch: string;
  baseBranch: string;
  email: string;
  prList: any[];
  issueList: any[];
  optimizeForDisabled: boolean;
  mergeMethod: MergeMethod;
} = {} as any;

const defaults = {
  hostType: PLATFORM_TYPE_GITLAB,
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
    defaults.endpoint = ensureTrailingSlash(endpoint);
    setBaseUrl(defaults.endpoint);
  } else {
    logger.debug('Using default GitLab endpoint: ' + defaults.endpoint);
  }
  let gitAuthor: string;
  try {
    const user = (
      await gitlabApi.getJson<{ email: string; name: string; id: number }>(
        `user`,
        { token }
      )
    ).body;
    gitAuthor = `${user.name} <${user.email}>`;
    authorId = user.id;
  } catch (err) {
    logger.debug(
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
  logger.debug('Autodiscovering GitLab repositories');
  try {
    const url = `projects?membership=true&per_page=100&with_merge_requests_enabled=true&min_access_level=30`;
    const res = await gitlabApi.getJson<RepoResponse[]>(url, {
      paginate: true,
    });
    logger.debug(`Discovered ${res.body.length} project(s)`);
    return res.body
      .filter((repo) => !repo.mirror && !repo.archived)
      .map((repo) => repo.path_with_namespace);
  } catch (err) {
    logger.error({ err }, `GitLab getRepos error`);
    throw err;
  }
}

function urlEscape(str: string): string {
  return str ? str.replace(/\//g, '%2F') : str;
}

// Initialize GitLab by getting base branch
export async function initRepo({
  repository,
  localDir,
  optimizeForDisabled,
}: RepoParams): Promise<RepoConfig> {
  config = {} as any;
  config.repository = urlEscape(repository);
  config.localDir = localDir;

  let res: HttpResponse<RepoResponse>;
  try {
    res = await gitlabApi.getJson<RepoResponse>(
      `projects/${config.repository}`
    );
    if (res.body.archived) {
      logger.debug(
        'Repository is archived - throwing error to abort renovation'
      );
      throw new Error(REPOSITORY_ARCHIVED);
    }
    if (res.body.mirror) {
      logger.debug(
        'Repository is a mirror - throwing error to abort renovation'
      );
      throw new Error(REPOSITORY_MIRRORED);
    }
    if (res.body.repository_access_level === 'disabled') {
      logger.debug(
        'Repository portion of project is disabled - throwing error to abort renovation'
      );
      throw new Error(REPOSITORY_DISABLED);
    }
    if (res.body.merge_requests_access_level === 'disabled') {
      logger.debug(
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
            (
              await gitlabApi.getJson<{ content: string }>(
                `projects/${config.repository}/repository/files/${defaultConfigFile}?ref=${res.body.default_branch}`
              )
            ).body.content,
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
    config.mergeMethod = res.body.merge_method || 'merge';
    logger.debug(`${repository} default branch = ${config.baseBranch}`);
    delete config.prList;
    logger.debug('Enabling Git FS');
    const opts = hostRules.find({
      hostType: defaults.hostType,
      url: defaults.endpoint,
    });
    let url: string;
    if (
      process.env.GITLAB_IGNORE_REPO_URL ||
      res.body.http_url_to_repo === null
    ) {
      logger.debug('no http_url_to_repo found. Falling back to old behaviour.');
      const { host, protocol } = URL.parse(defaults.endpoint);
      url = git.getUrl({
        protocol: protocol.slice(0, -1) as any,
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
    await git.initRepo({
      ...config,
      url,
      gitAuthorName: global.gitAuthor?.name,
      gitAuthorEmail: global.gitAuthor?.email,
    });
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err }, 'Caught initRepo error');
    if (err.message.includes('HEAD is not a symbolic ref')) {
      throw new Error(REPOSITORY_EMPTY);
    }
    if ([REPOSITORY_ARCHIVED, REPOSITORY_EMPTY].includes(err.message)) {
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
    logger.debug({ err }, 'Unknown GitLab initRepo error');
    throw err;
  }
  const repoConfig: RepoConfig = {
    defaultBranch: config.baseBranch,
    isFork: !!res.body.forked_from_project,
  };
  return repoConfig;
}

export function getRepoForceRebase(): Promise<boolean> {
  return Promise.resolve(config?.mergeMethod !== 'merge');
}

export async function setBaseBranch(
  branchName = config.baseBranch
): Promise<string> {
  logger.debug(`Setting baseBranch to ${branchName}`);
  config.baseBranch = branchName;
  const baseBranchSha = await git.setBranch(branchName);
  return baseBranchSha;
}

type BranchState = 'pending' | 'running' | 'success' | 'failed' | 'canceled';

interface GitlabBranchStatus {
  status: BranchState;
  name: string;
  allow_failure?: boolean;
}

async function getStatus(
  branchName: string,
  useCache = true
): Promise<GitlabBranchStatus[]> {
  const branchSha = await git.getBranchCommit(branchName);
  const url = `projects/${config.repository}/repository/commits/${branchSha}/statuses`;

  return (
    await gitlabApi.getJson<GitlabBranchStatus[]>(url, {
      paginate: true,
      useCache,
    })
  ).body;
}

const gitlabToRenovateStatusMapping: Record<string, BranchStatus> = {
  pending: BranchStatus.yellow,
  created: BranchStatus.yellow,
  manual: BranchStatus.yellow,
  running: BranchStatus.yellow,
  success: BranchStatus.green,
  failed: BranchStatus.red,
  canceled: BranchStatus.red,
  skipped: BranchStatus.red,
};

// Returns the combined status for a branch.
export async function getBranchStatus(
  branchName: string,
  requiredStatusChecks?: string[] | null
): Promise<BranchStatus> {
  logger.debug(`getBranchStatus(${branchName})`);
  if (!requiredStatusChecks) {
    // null means disable status checks, so it always succeeds
    return BranchStatus.green;
  }
  if (Array.isArray(requiredStatusChecks) && requiredStatusChecks.length) {
    // This is Unsupported
    logger.warn({ requiredStatusChecks }, `Unsupported requiredStatusChecks`);
    return BranchStatus.red;
  }

  if (!(await git.branchExists(branchName))) {
    throw new Error(REPOSITORY_CHANGED);
  }

  const res = await getStatus(branchName);
  logger.debug(`Got res with ${res.length} results`);
  if (res.length === 0) {
    // Return 'pending' if we have no status checks
    return BranchStatus.yellow;
  }
  let status: BranchStatus = BranchStatus.green; // default to green
  res
    .filter((check) => !check.allow_failure)
    .forEach((check) => {
      if (status !== BranchStatus.red) {
        // if red, stay red
        let mappedStatus: BranchStatus =
          gitlabToRenovateStatusMapping[check.status];
        if (!mappedStatus) {
          logger.warn(
            { check },
            'Could not map GitLab check.status to Renovate status'
          );
          mappedStatus = BranchStatus.yellow;
        }
        if (mappedStatus !== BranchStatus.green) {
          logger.trace({ check }, 'Found non-green check');
          status = mappedStatus;
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
  const res = await gitlabApi.postJson<Pr & { iid: number }>(
    `projects/${config.repository}/merge_requests`,
    {
      body: {
        source_branch: branchName,
        target_branch: targetBranch,
        remove_source_branch: true,
        title,
        description,
        labels: is.array(labels) ? labels.join(',') : null,
      },
    }
  );
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
      const desiredStatus = 'can_be_merged';
      const retryTimes = 5;

      // Check for correct merge request status before setting `merge_when_pipeline_succeeds` to  `true`.
      for (let attempt = 1; attempt <= retryTimes; attempt += 1) {
        const { body } = await gitlabApi.getJson<{
          merge_status: string;
          pipeline: string;
        }>(`projects/${config.repository}/merge_requests/${pr.iid}`);
        // Only continue if the merge request can be merged and has a pipeline.
        if (body.merge_status === desiredStatus && body.pipeline !== null) {
          break;
        }
        await delay(500 * attempt);
      }

      await gitlabApi.putJson(
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
  const pr = (
    await gitlabApi.getJson<
      Pr & {
        iid: number;
        source_branch: string;
        target_branch: string;
        description: string;
        diverged_commits_count: number;
        merge_status: string;
        assignee?: { id?: number };
        assignees?: { id?: number }[];
      }
    >(url)
  ).body;
  // Harmonize fields with GitHub
  pr.branchName = pr.source_branch;
  pr.targetBranch = pr.target_branch;
  pr.number = pr.iid;
  pr.displayNumber = `Merge Request #${pr.iid}`;
  pr.body = pr.description;
  pr.isStale = pr.diverged_commits_count > 0;
  pr.state = pr.state === 'opened' ? PR_STATE_OPEN : pr.state;
  pr.isModified = true;
  pr.hasAssignees = !!(pr.assignee?.id || pr.assignees?.[0]?.id);
  delete pr.assignee;
  delete pr.assignees;
  pr.hasReviewers = false;
  if (pr.merge_status === 'cannot_be_merged') {
    logger.debug('pr cannot be merged');
    pr.canMerge = false;
    pr.isConflicted = true;
  } else if (pr.state === PR_STATE_OPEN) {
    const branchStatus = await getBranchStatus(pr.branchName, []);
    if (branchStatus === BranchStatus.green) {
      pr.canMerge = true;
    }
  }
  // Check if the most recent branch commit is by us
  // If not then we don't allow it to be rebased, in case someone's changes would be lost
  const branchUrl = `projects/${
    config.repository
  }/repository/branches/${urlEscape(pr.source_branch)}`;
  try {
    const branch = (
      await gitlabApi.getJson<{ commit: { author_email: string } }>(branchUrl)
    ).body;
    const branchCommitEmail =
      branch && branch.commit ? branch.commit.author_email : null;
    if (branchCommitEmail === global.gitAuthor.email) {
      pr.isModified = false;
    } else {
      logger.debug(
        { branchCommitEmail, configEmail: global.gitAuthor.email, iid: pr.iid },
        'Last committer to branch does not match bot email, so PR cannot be rebased.'
      );
      pr.isModified = true;
    }
  } catch (err) {
    logger.debug({ err }, 'Error getting PR branch');
    if (pr.state === PR_STATE_OPEN || err.statusCode !== 404) {
      logger.warn({ err }, 'Error getting PR branch');
      pr.isConflicted = true;
    }
  }
  return pr;
}

// istanbul ignore next
async function closePr(iid: number): Promise<void> {
  await gitlabApi.putJson(
    `projects/${config.repository}/merge_requests/${iid}`,
    {
      body: {
        state_event: 'close',
      },
    }
  );
}

export async function updatePr(
  iid: number,
  title: string,
  description: string
): Promise<void> {
  await gitlabApi.putJson(
    `projects/${config.repository}/merge_requests/${iid}`,
    {
      body: {
        title,
        description: sanitize(description),
      },
    }
  );
}

export async function mergePr(iid: number): Promise<boolean> {
  try {
    await gitlabApi.putJson(
      `projects/${config.repository}/merge_requests/${iid}/merge`,
      {
        body: {
          should_remove_source_branch: true,
        },
      }
    );
    return true;
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 401) {
      logger.debug('No permissions to merge PR');
      return false;
    }
    if (err.statusCode === 406) {
      logger.debug({ err }, 'PR not acceptable for merging');
      return false;
    }
    logger.debug({ err }, 'merge PR error');
    logger.debug('PR merge failed');
    return false;
  }
}

export function getPrBody(input: string): string {
  return smartTruncate(
    input
      .replace(/Pull Request/g, 'Merge Request')
      .replace(/PR/g, 'MR')
      .replace(/\]\(\.\.\/pull\//g, '](!'),
    50000
  );
}

// Branch

// Returns the Pull Request for a branch. Null if not exists.
export async function getBranchPr(branchName: string): Promise<Pr> {
  logger.debug(`getBranchPr(${branchName})`);
  // istanbul ignore if
  if (!(await git.branchExists(branchName))) {
    return null;
  }
  const query = new URLSearchParams({
    per_page: '100',
    state: 'opened',
    source_branch: branchName,
  }).toString();
  const urlString = `projects/${config.repository}/merge_requests?${query}`;
  const res = await gitlabApi.getJson<{ source_branch: string }[]>(urlString, {
    paginate: true,
  });
  logger.debug(`Got res with ${res.body.length} results`);
  let pr: any = null;
  res.body.forEach((result) => {
    if (result.source_branch === branchName) {
      pr = result;
    }
  });
  if (!pr) {
    return null;
  }
  return getPr(pr.iid);
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
  return git.deleteBranch(branchName);
}

export async function getBranchStatusCheck(
  branchName: string,
  context: string
): Promise<BranchStatus | null> {
  // cache-bust in case we have rebased
  const res = await getStatus(branchName, false);
  logger.debug(`Got res with ${res.length} results`);
  for (const check of res) {
    if (check.name === context) {
      return gitlabToRenovateStatusMapping[check.status] || BranchStatus.yellow;
    }
  }
  return null;
}

export async function setBranchStatus({
  branchName,
  context,
  description,
  state: renovateState,
  url: targetUrl,
}: BranchStatusConfig): Promise<void> {
  // First, get the branch commit SHA
  const branchSha = await git.getBranchCommit(branchName);
  // Now, check the statuses for that commit
  const url = `projects/${config.repository}/statuses/${branchSha}`;
  let state = 'success';
  if (renovateState === BranchStatus.yellow) {
    state = 'pending';
  } else if (renovateState === BranchStatus.red) {
    state = 'failed';
  }
  const options: any = {
    state,
    description,
    context,
  };
  if (targetUrl) {
    options.target_url = targetUrl;
  }
  try {
    await gitlabApi.postJson(url, { body: options });

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
      logger.debug('Ignoring status transition error');
    } else {
      logger.debug({ err });
      logger.warn('Failed to set branch status');
    }
  }
}

// Issue

export async function getIssueList(): Promise<any[]> {
  if (!config.issueList) {
    const query = new URLSearchParams({
      per_page: '100',
      author_id: `${authorId}`,
      state: 'opened',
    }).toString();
    const res = await gitlabApi.getJson<{ iid: number; title: string }[]>(
      `projects/${config.repository}/issues?${query}`,
      {
        useCache: false,
        paginate: true,
      }
    );
    // istanbul ignore if
    if (!is.array(res.body)) {
      logger.warn({ responseBody: res.body }, 'Could not retrieve issue list');
      return [];
    }
    config.issueList = res.body.map((i) => ({
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
    const issueBody = (
      await gitlabApi.getJson<{ description: string }>(
        `projects/${config.repository}/issues/${issue.iid}`
      )
    ).body.description;
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
  reuseTitle,
  body,
}: EnsureIssueConfig): Promise<'updated' | 'created' | null> {
  logger.debug(`ensureIssue()`);
  const description = getPrBody(sanitize(body));
  try {
    const issueList = await getIssueList();
    let issue = issueList.find((i: { title: string }) => i.title === title);
    if (!issue) {
      issue = issueList.find((i: { title: string }) => i.title === reuseTitle);
    }
    if (issue) {
      const existingDescription = (
        await gitlabApi.getJson<{ description: string }>(
          `projects/${config.repository}/issues/${issue.iid}`
        )
      ).body.description;
      if (issue.title !== title || existingDescription !== description) {
        logger.debug('Updating issue');
        await gitlabApi.putJson(
          `projects/${config.repository}/issues/${issue.iid}`,
          {
            body: { title, description },
          }
        );
        return 'updated';
      }
    } else {
      await gitlabApi.postJson(`projects/${config.repository}/issues`, {
        body: {
          title,
          description,
        },
      });
      logger.info('Issue created');
      // delete issueList so that it will be refetched as necessary
      delete config.issueList;
      return 'created';
    }
  } catch (err) /* istanbul ignore next */ {
    if (err.message.startsWith('Issues are disabled for this repo')) {
      logger.debug(`Could not create issue: ${err.message}`);
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
      logger.debug({ issue }, 'Closing issue');
      await gitlabApi.putJson(
        `projects/${config.repository}/issues/${issue.iid}`,
        {
          body: { state_event: 'close' },
        }
      );
    }
  }
}

export async function addAssignees(
  iid: number,
  assignees: string[]
): Promise<void> {
  logger.debug(`Adding assignees ${assignees} to #${iid}`);
  try {
    let assigneeId = (
      await gitlabApi.getJson<{ id: number }[]>(
        `users?username=${assignees[0]}`
      )
    ).body[0].id;
    let url = `projects/${config.repository}/merge_requests/${iid}?assignee_id=${assigneeId}`;
    await gitlabApi.putJson(url);
    try {
      if (assignees.length > 1) {
        url = `projects/${config.repository}/merge_requests/${iid}?assignee_ids[]=${assigneeId}`;
        for (let i = 1; i < assignees.length; i += 1) {
          assigneeId = (
            await gitlabApi.getJson<{ id: number }[]>(
              `users?username=${assignees[i]}`
            )
          ).body[0].id;
          url += `&assignee_ids[]=${assigneeId}`;
        }
        await gitlabApi.putJson(url);
      }
    } catch (error) {
      logger.error({ iid, assignees }, 'Failed to add multiple assignees');
    }
  } catch (err) {
    logger.debug({ err }, 'addAssignees error');
    logger.warn({ iid, assignees }, 'Failed to add assignees');
  }
}

export function addReviewers(iid: number, reviewers: string[]): Promise<void> {
  logger.debug(`addReviewers('${iid}, '${reviewers})`);
  logger.warn('Unimplemented in GitLab: approvals');
  return Promise.resolve();
}

export async function deleteLabel(
  issueNo: number,
  label: string
): Promise<void> {
  logger.debug(`Deleting label ${label} from #${issueNo}`);
  try {
    const pr = await getPr(issueNo);
    const labels = (pr.labels || []).filter((l: string) => l !== label).join();
    await gitlabApi.putJson(
      `projects/${config.repository}/merge_requests/${issueNo}`,
      {
        body: { labels },
      }
    );
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err, issueNo, label }, 'Failed to delete label');
  }
}

async function getComments(issueNo: number): Promise<GitlabComment[]> {
  // GET projects/:owner/:repo/merge_requests/:number/notes
  logger.debug(`Getting comments for #${issueNo}`);
  const url = `projects/${config.repository}/merge_requests/${issueNo}/notes`;
  const comments = (
    await gitlabApi.getJson<GitlabComment[]>(url, { paginate: true })
  ).body;
  logger.debug(`Found ${comments.length} comments`);
  return comments;
}

async function addComment(issueNo: number, body: string): Promise<void> {
  // POST projects/:owner/:repo/merge_requests/:number/notes
  await gitlabApi.postJson(
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
  await gitlabApi.putJson(
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
  await gitlabApi.deleteJson(
    `projects/${config.repository}/merge_requests/${issueNo}/notes/${commentId}`
  );
}

export async function ensureComment({
  number,
  topic,
  content,
}: EnsureCommentConfig): Promise<boolean> {
  const sanitizedContent = sanitize(content);
  const massagedTopic = topic
    ? topic.replace(/Pull Request/g, 'Merge Request').replace(/PR/g, 'MR')
    : topic;
  const comments = await getComments(number);
  let body: string;
  let commentId: number;
  let commentNeedsUpdating: boolean;
  if (topic) {
    logger.debug(`Ensuring comment "${massagedTopic}" in #${number}`);
    body = `### ${topic}\n\n${sanitizedContent}`;
    body = body.replace(/Pull Request/g, 'Merge Request').replace(/PR/g, 'MR');
    comments.forEach((comment: { body: string; id: number }) => {
      if (comment.body.startsWith(`### ${massagedTopic}\n\n`)) {
        commentId = comment.id;
        commentNeedsUpdating = comment.body !== body;
      }
    });
  } else {
    logger.debug(`Ensuring content-only comment in #${number}`);
    body = `${sanitizedContent}`;
    comments.forEach((comment: { body: string; id: number }) => {
      if (comment.body === body) {
        commentId = comment.id;
        commentNeedsUpdating = false;
      }
    });
  }
  if (!commentId) {
    await addComment(number, body);
    logger.debug(
      { repository: config.repository, issueNo: number },
      'Added comment'
    );
  } else if (commentNeedsUpdating) {
    await editComment(number, commentId, body);
    logger.debug(
      { repository: config.repository, issueNo: number },
      'Updated comment'
    );
  } else {
    logger.debug('Comment is already update-to-date');
  }
  return true;
}

type GitlabComment = {
  body: string;
  id: number;
};

export async function ensureCommentRemoval({
  number: issueNo,
  topic,
  content,
}: EnsureCommentRemovalConfig): Promise<void> {
  logger.debug(
    `Ensuring comment "${topic || content}" in #${issueNo} is removed`
  );

  const comments = await getComments(issueNo);
  let commentId: number | null = null;

  const byTopic = (comment: GitlabComment): boolean =>
    comment.body.startsWith(`### ${topic}\n\n`);
  const byContent = (comment: GitlabComment): boolean =>
    comment.body.trim() === content;

  if (topic) {
    commentId = comments.find(byTopic)?.id;
  } else if (content) {
    commentId = comments.find(byContent)?.id;
  }

  if (commentId) {
    await deleteComment(issueNo, commentId);
  }
}

async function fetchPrList(): Promise<Pr[]> {
  const query = new URLSearchParams({
    per_page: '100',
    author_id: `${authorId}`,
  }).toString();
  const urlString = `projects/${config.repository}/merge_requests?${query}`;
  try {
    const res = await gitlabApi.getJson<
      {
        iid: number;
        source_branch: string;
        title: string;
        state: string;
        created_at: string;
      }[]
    >(urlString, { paginate: true });
    return res.body.map((pr) => ({
      number: pr.iid,
      branchName: pr.source_branch,
      title: pr.title,
      state: pr.state === 'opened' ? PR_STATE_OPEN : pr.state,
      createdAt: pr.created_at,
    }));
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
  if (desiredState === PR_STATE_ALL) {
    return true;
  }
  if (desiredState.startsWith('!')) {
    return state !== desiredState.substring(1);
  }
  return state === desiredState;
}

export async function findPr({
  branchName,
  prTitle,
  state = PR_STATE_ALL,
}: FindPRConfig): Promise<Pr> {
  logger.debug(`findPr(${branchName}, ${prTitle}, ${state})`);
  const prList = await getPrList();
  return prList.find(
    (p: { branchName: string; title: string; state: string }) =>
      p.branchName === branchName &&
      (!prTitle || p.title === prTitle) &&
      matchesState(p.state, state)
  );
}

export function getVulnerabilityAlerts(): Promise<VulnerabilityAlert[]> {
  return Promise.resolve([]);
}
