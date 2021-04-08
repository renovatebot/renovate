import URL from 'url';
import is from '@sindresorhus/is';
import delay from 'delay';
import pAll from 'p-all';
import { lt } from 'semver';
import {
  PLATFORM_AUTHENTICATION_ERROR,
  REPOSITORY_ACCESS_FORBIDDEN,
  REPOSITORY_ARCHIVED,
  REPOSITORY_CHANGED,
  REPOSITORY_DISABLED,
  REPOSITORY_EMPTY,
  REPOSITORY_MIRRORED,
  REPOSITORY_NOT_FOUND,
  TEMPORARY_ERROR,
} from '../../constants/error-messages';
import { PLATFORM_TYPE_GITLAB } from '../../constants/platforms';
import { logger } from '../../logger';
import { BranchStatus, PrState, VulnerabilityAlert } from '../../types';
import * as git from '../../util/git';
import * as hostRules from '../../util/host-rules';
import { HttpResponse } from '../../util/http';
import { setBaseUrl } from '../../util/http/gitlab';
import { sanitize } from '../../util/sanitize';
import { ensureTrailingSlash, getQueryString } from '../../util/url';
import type {
  BranchStatusConfig,
  CreatePRConfig,
  EnsureCommentConfig,
  EnsureCommentRemovalConfig,
  EnsureIssueConfig,
  FindPRConfig,
  Issue,
  PlatformParams,
  PlatformPrOptions,
  PlatformResult,
  Pr,
  RepoParams,
  RepoResult,
  UpdatePrConfig,
} from '../types';
import { smartTruncate } from '../utils/pr-body';
import { getUserID, gitlabApi } from './http';
import { getMR, updateMR } from './merge-request';
import type {
  GitLabMergeRequest,
  GitlabComment,
  GitlabIssue,
  MergeMethod,
  RepoResponse,
} from './types';

let config: {
  repository: string;
  localDir: string;
  email: string;
  prList: any[];
  issueList: GitlabIssue[];
  mergeMethod: MergeMethod;
  defaultBranch: string;
  cloneSubmodules: boolean;
  ignorePrAuthor: boolean;
} = {} as any;

const defaults = {
  hostType: PLATFORM_TYPE_GITLAB,
  endpoint: 'https://gitlab.com/api/v4/',
  version: '0.0.0',
};

const DRAFT_PREFIX = 'Draft: ';
const DRAFT_PREFIX_DEPRECATED = 'WIP: ';

let authorId: number;
let draftPrefix = DRAFT_PREFIX;

export async function initPlatform({
  endpoint,
  token,
}: PlatformParams): Promise<PlatformResult> {
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
  let gitlabVersion: string;
  try {
    const user = (
      await gitlabApi.getJson<{ email: string; name: string; id: number }>(
        `user`,
        { token }
      )
    ).body;
    gitAuthor = `${user.name} <${user.email}>`;
    authorId = user.id;
    // version is 'x.y.z-edition', so not strictly semver; need to strip edition
    gitlabVersion = (
      await gitlabApi.getJson<{ version: string }>('version', { token })
    ).body.version.split('-')[0];
    logger.debug('GitLab version is: ' + gitlabVersion);
    defaults.version = gitlabVersion;
  } catch (err) {
    logger.debug(
      { err },
      'Error authenticating with GitLab. Check that your token includes "api" permissions'
    );
    throw new Error('Init: Authentication failure');
  }
  draftPrefix = lt(gitlabVersion, '13.2.0')
    ? DRAFT_PREFIX_DEPRECATED
    : DRAFT_PREFIX;
  const platformConfig: PlatformResult = {
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

export async function getRawFile(
  fileName: string,
  repo: string = config.repository
): Promise<string | null> {
  const escapedFileName = urlEscape(fileName);
  const url = `projects/${repo}/repository/files/${escapedFileName}?ref=HEAD`;
  const res = await gitlabApi.getJson<{ content: string }>(url);
  const buf = res.body.content;
  const str = Buffer.from(buf, 'base64').toString();
  return str;
}

export async function getJsonFile(
  fileName: string,
  repo: string = config.repository
): Promise<any | null> {
  const raw = await getRawFile(fileName, repo);
  return JSON.parse(raw);
}

// Initialize GitLab by getting base branch
export async function initRepo({
  repository,
  localDir,
  cloneSubmodules,
  ignorePrAuthor,
}: RepoParams): Promise<RepoResult> {
  config = {} as any;
  config.repository = urlEscape(repository);
  config.localDir = localDir;
  config.cloneSubmodules = cloneSubmodules;
  config.ignorePrAuthor = ignorePrAuthor;

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
    config.defaultBranch = res.body.default_branch;
    // istanbul ignore if
    if (!config.defaultBranch) {
      logger.warn({ resBody: res.body }, 'Error fetching GitLab project');
      throw new Error(TEMPORARY_ERROR);
    }
    config.mergeMethod = res.body.merge_method || 'merge';
    logger.debug(`${repository} default branch = ${config.defaultBranch}`);
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
  const repoConfig: RepoResult = {
    defaultBranch: config.defaultBranch,
    isFork: !!res.body.forked_from_project,
  };
  return repoConfig;
}

export function getRepoForceRebase(): Promise<boolean> {
  return Promise.resolve(config?.mergeMethod !== 'merge');
}

type BranchState =
  | 'pending'
  | 'created'
  | 'running'
  | 'manual'
  | 'success'
  | 'failed'
  | 'canceled'
  | 'skipped';

interface GitlabBranchStatus {
  status: BranchState;
  name: string;
  allow_failure?: boolean;
}

async function getStatus(
  branchName: string,
  useCache = true
): Promise<GitlabBranchStatus[]> {
  const branchSha = git.getBranchCommit(branchName);
  try {
    const url = `projects/${config.repository}/repository/commits/${branchSha}/statuses`;

    return (
      await gitlabApi.getJson<GitlabBranchStatus[]>(url, {
        paginate: true,
        useCache,
      })
    ).body;
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err }, 'Error getting commit status');
    if (err.response?.statusCode === 404) {
      throw new Error(REPOSITORY_CHANGED);
    }
    throw err;
  }
}

const gitlabToRenovateStatusMapping: Record<BranchState, BranchStatus> = {
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

  if (!git.branchExists(branchName)) {
    throw new Error(REPOSITORY_CHANGED);
  }

  const branchStatuses = await getStatus(branchName);
  logger.debug(`Got res with ${branchStatuses.length} results`);
  // ignore all skipped jobs
  const res = branchStatuses.filter((check) => check.status !== 'skipped');
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

function massagePr(prToModify: Pr): Pr {
  const pr = prToModify;
  if (pr.title.startsWith(DRAFT_PREFIX)) {
    pr.title = pr.title.substring(DRAFT_PREFIX.length);
    pr.isDraft = true;
  } else if (pr.title.startsWith(DRAFT_PREFIX_DEPRECATED)) {
    pr.title = pr.title.substring(DRAFT_PREFIX_DEPRECATED.length);
    pr.isDraft = true;
  }
  return pr;
}

async function fetchPrList(): Promise<Pr[]> {
  const searchParams = {
    per_page: '100',
  } as any;
  // istanbul ignore if
  if (config.ignorePrAuthor) {
    // https://docs.gitlab.com/ee/api/merge_requests.html#list-merge-requests
    // default: `scope=created_by_me`
    searchParams.scope = 'all';
  }
  const query = getQueryString(searchParams);
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
    return res.body.map((pr) =>
      massagePr({
        number: pr.iid,
        sourceBranch: pr.source_branch,
        title: pr.title,
        state: pr.state === 'opened' ? PrState.Open : pr.state,
        createdAt: pr.created_at,
      })
    );
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

async function tryPrAutomerge(
  pr: number,
  platformOptions: PlatformPrOptions
): Promise<void> {
  if (platformOptions?.gitLabAutomerge) {
    try {
      const desiredStatus = 'can_be_merged';
      const retryTimes = 5;

      // Check for correct merge request status before setting `merge_when_pipeline_succeeds` to  `true`.
      for (let attempt = 1; attempt <= retryTimes; attempt += 1) {
        const { body } = await gitlabApi.getJson<{
          merge_status: string;
          pipeline: string;
        }>(`projects/${config.repository}/merge_requests/${pr}`);
        // Only continue if the merge request can be merged and has a pipeline.
        if (body.merge_status === desiredStatus && body.pipeline !== null) {
          break;
        }
        await delay(500 * attempt);
      }

      await gitlabApi.putJson(
        `projects/${config.repository}/merge_requests/${pr}/merge`,
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
}

export async function createPr({
  sourceBranch,
  targetBranch,
  prTitle,
  prBody: rawDescription,
  draftPR,
  labels,
  platformOptions,
}: CreatePRConfig): Promise<Pr> {
  let title = prTitle;
  if (draftPR) {
    title = draftPrefix + title;
  }
  const description = sanitize(rawDescription);
  logger.debug(`Creating Merge Request: ${title}`);
  const res = await gitlabApi.postJson<Pr & { iid: number }>(
    `projects/${config.repository}/merge_requests`,
    {
      body: {
        source_branch: sourceBranch,
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
  pr.sourceBranch = sourceBranch;
  pr.displayNumber = `Merge Request #${pr.iid}`;
  // istanbul ignore if
  if (config.prList) {
    config.prList.push(pr);
  }

  await tryPrAutomerge(pr.iid, platformOptions);

  return massagePr(pr);
}

export async function getPr(iid: number): Promise<Pr> {
  logger.debug(`getPr(${iid})`);
  const mr = await getMR(config.repository, iid);

  // Harmonize fields with GitHub
  const pr: Pr = {
    sourceBranch: mr.source_branch,
    targetBranch: mr.target_branch,
    number: mr.iid,
    displayNumber: `Merge Request #${mr.iid}`,
    body: mr.description,
    state: mr.state === 'opened' ? PrState.Open : mr.state,
    hasAssignees: !!(mr.assignee?.id || mr.assignees?.[0]?.id),
    hasReviewers: !!mr.reviewers?.length,
    title: mr.title,
    labels: mr.labels,
    sha: mr.sha,
  };

  if (mr.merge_status === 'cannot_be_merged') {
    logger.debug('pr cannot be merged');
    pr.canMerge = false;
    pr.isConflicted = true;
  } else if (pr.state === PrState.Open) {
    const branchStatus = await getBranchStatus(pr.sourceBranch, []);
    if (branchStatus === BranchStatus.green) {
      pr.canMerge = true;
    }
  }
  return massagePr(pr);
}

export async function updatePr({
  number: iid,
  prTitle,
  prBody: description,
  state,
  platformOptions,
}: UpdatePrConfig): Promise<void> {
  let title = prTitle;
  if ((await getPrList()).find((pr) => pr.number === iid)?.isDraft) {
    title = draftPrefix + title;
  }
  const newState = {
    [PrState.Closed]: 'close',
    [PrState.Open]: 'reopen',
  }[state];
  await gitlabApi.putJson(
    `projects/${config.repository}/merge_requests/${iid}`,
    {
      body: {
        title,
        description: sanitize(description),
        ...(newState && { state_event: newState }),
      },
    }
  );

  await tryPrAutomerge(iid, platformOptions);
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

export function massageMarkdown(input: string): string {
  let desc = input
    .replace(/Pull Request/g, 'Merge Request')
    .replace(/PR/g, 'MR')
    .replace(/\]\(\.\.\/pull\//g, '](!');

  if (lt(defaults.version, '13.4.0')) {
    logger.debug(
      { version: defaults.version },
      'GitLab versions earlier than 13.4 have issues with long descriptions, truncating to 25K characters'
    );

    desc = smartTruncate(desc, 25000);
  }

  return desc;
}

// Branch

function matchesState(state: string, desiredState: string): boolean {
  if (desiredState === PrState.All) {
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
  state = PrState.All,
}: FindPRConfig): Promise<Pr> {
  logger.debug(`findPr(${branchName}, ${prTitle}, ${state})`);
  const prList = await getPrList();
  return prList.find(
    (p: { sourceBranch: string; title: string; state: string }) =>
      p.sourceBranch === branchName &&
      (!prTitle || p.title === prTitle) &&
      matchesState(p.state, state)
  );
}

// Returns the Pull Request for a branch. Null if not exists.
export async function getBranchPr(branchName: string): Promise<Pr> {
  logger.debug(`getBranchPr(${branchName})`);
  const existingPr = await findPr({
    branchName,
    state: PrState.Open,
  });
  return existingPr ? getPr(existingPr.number) : null;
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
  const branchSha = git.getBranchCommit(branchName);
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
    // give gitlab some time to create pipelines for the sha
    await delay(1000);

    await gitlabApi.postJson(url, { body: options });

    // update status cache
    await getStatus(branchName, false);
  } catch (err) /* istanbul ignore next */ {
    if (
      err.body?.message?.startsWith(
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

export async function getIssueList(): Promise<GitlabIssue[]> {
  if (!config.issueList) {
    const query = getQueryString({
      per_page: '100',
      author_id: `${authorId}`,
      state: 'opened',
    });
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
    const issue = issueList.find((i) => i.title === title);
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
  const description = massageMarkdown(sanitize(body));
  try {
    const issueList = await getIssueList();
    let issue = issueList.find((i) => i.title === title);
    if (!issue) {
      issue = issueList.find((i) => i.title === reuseTitle);
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
      logger.debug(`Could not create issue: ${(err as Error).message}`);
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
  logger.debug(`Adding assignees '${assignees.join(', ')}' to #${iid}`);
  try {
    let assigneeId = await getUserID(assignees[0]);
    let url = `projects/${config.repository}/merge_requests/${iid}?assignee_id=${assigneeId}`;
    await gitlabApi.putJson(url);
    try {
      if (assignees.length > 1) {
        url = `projects/${config.repository}/merge_requests/${iid}?assignee_ids[]=${assigneeId}`;
        for (let i = 1; i < assignees.length; i += 1) {
          assigneeId = await getUserID(assignees[i]);
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

export async function addReviewers(
  iid: number,
  reviewers: string[]
): Promise<void> {
  logger.debug(`Adding reviewers '${reviewers.join(', ')}' to #${iid}`);

  if (lt(defaults.version, '13.9.0')) {
    logger.warn(
      { version: defaults.version },
      'Adding reviewers is only available in GitLab 13.9 and onwards'
    );
    return;
  }

  let mr: GitLabMergeRequest;
  try {
    mr = await getMR(config.repository, iid);
  } catch (err) {
    logger.warn({ err }, 'Failed to get existing reviewers');
    return;
  }

  mr.reviewers = mr.reviewers ?? [];
  const existingReviewers = mr.reviewers.map((r) => r.username);
  const existingReviewerIDs = mr.reviewers.map((r) => r.id);

  // Figure out which reviewers (of the ones we want to add) are not already on the MR as a reviewer
  const newReviewers = reviewers.filter((r) => !existingReviewers.includes(r));

  // Gather the IDs for all the reviewers we want to add
  let newReviewerIDs: number[];
  try {
    newReviewerIDs = await pAll(
      newReviewers.map((r) => () => getUserID(r)),
      { concurrency: 5 }
    );
  } catch (err) {
    logger.warn({ err }, 'Failed to get IDs of the new reviewers');
    return;
  }

  try {
    await updateMR(config.repository, iid, {
      reviewer_ids: [...existingReviewerIDs, ...newReviewerIDs],
    });
  } catch (err) {
    logger.warn({ err }, 'Failed to add reviewers');
  }
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

export function getVulnerabilityAlerts(): Promise<VulnerabilityAlert[]> {
  return Promise.resolve([]);
}
