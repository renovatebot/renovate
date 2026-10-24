import { isNonEmptyString } from '@sindresorhus/is';
import { GlobalConfig } from '../../../config/global.ts';
import type { MergeStrategy } from '../../../config/types.ts';
import {
  CONFIG_GIT_URL_UNAVAILABLE,
  REPOSITORY_ACCESS_FORBIDDEN,
  REPOSITORY_BLOCKED,
  REPOSITORY_EMPTY,
  REPOSITORY_NOT_FOUND,
} from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import type { BranchStatus } from '../../../types/index.ts';
import { parseJson } from '../../../util/common.ts';
import * as git from '../../../util/git/index.ts';
import { OnedevHttp, setBaseUrl } from '../../../util/http/onedev.ts';
import { regEx } from '../../../util/regex.ts';
import { sanitize } from '../../../util/sanitize.ts';
import { joinUrlParts, parseUrl } from '../../../util/url.ts';
import { getPrBodyStruct } from '../pr-body.ts';
import type {
  AutodiscoverConfig,
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
} from '../types.ts';
import { repoFingerprint } from '../util.ts';
import { smartTruncate } from '../utils/pr-body.ts';
import * as helper from './onedev-helper.ts';
import type { Build, Project, PullRequest, User } from './schema.ts';
import type { OneDevCredentials, PullRequestMergeStrategy } from './types.ts';

interface OneDevRepoConfig {
  repository: string;
  projectId: number;
  defaultBranch: string;
  isFork: boolean;
  ignorePrAuthor: boolean;
  /** PR number -> OneDev request id, used for every PR mutation. */
  prRequestIds: Map<number, number>;
  prList: Pr[] | null;
  /** Issue number -> OneDev issue id. */
  issueIds: Map<number, number>;
  issueList: Promise<Issue[]> | null;
}

export const id = 'onedev';

export const experimental = true;

export const onedevHttp = new OnedevHttp();

const defaultEndpoint = 'https://onedev.example.com/';

let endpoint = defaultEndpoint;

let config: OneDevRepoConfig = {} as any;

let botUser: User | undefined;

export function maxBodyLength(): number {
  return 100000;
}

export function resetPlatform(): void {
  config = {} as any;
  botUser = undefined;
  endpoint = normalizeEndpoint(defaultEndpoint);
  helper.resetCredentials();
  setBaseUrl(endpoint);
}

/**
 * Normalizes a OneDev endpoint into the `~api` REST base URL, so both
 * `https://server` and `https://server/~api` forms are accepted.
 */
function normalizeEndpoint(url: string): string {
  const trimmed = url.replace(regEx(/\/+$/), '');
  const withoutApiPath = trimmed.endsWith('/~api')
    ? trimmed.slice(0, -5)
    : trimmed;
  return `${withoutApiPath}/~api/`;
}

/**
 * Splits a token of the form `username:token-or-password` into its parts.
 *
 * OneDev authenticates REST and git-over-HTTPS requests with HTTP Basic
 * auth, so credentials carry both the username and the access token
 * (password). When no username is configured, `user` is assumed, which
 * OneDev accepts for personal access tokens.
 */
function parseToken(token: string, username?: string): OneDevCredentials {
  const separatorIndex = token.indexOf(':');
  if (separatorIndex > -1) {
    const parsedUsername = token.slice(0, separatorIndex);
    const password = token.slice(separatorIndex + 1);
    if (parsedUsername && password) {
      return { username: parsedUsername, password };
    }
    throw new Error(
      'Init: token must be in the form `username:token-or-password`, with neither part empty',
    );
  }
  return {
    username: username ?? 'user',
    password: token,
  };
}

const mergeStrategyMapping: Record<
  MergeStrategy,
  PullRequestMergeStrategy | undefined
> = {
  auto: undefined,
  'merge-commit': 'CREATE_MERGE_COMMIT',
  squash: 'SQUASH_SOURCE_BRANCH_COMMITS',
  rebase: 'REBASE_SOURCE_BRANCH_COMMITS',
  'rebase-merge': 'CREATE_MERGE_COMMIT',
  'fast-forward': 'CREATE_MERGE_COMMIT_IF_NECESSARY',
};

const buildStatusMapping: Record<Build['status'], BranchStatus> = {
  WAITING: 'yellow',
  PENDING: 'yellow',
  RUNNING: 'yellow',
  FAILED: 'red',
  CANCELLED: 'red',
  TIMED_OUT: 'red',
  SUCCESSFUL: 'green',
};

const prStateMapping: Record<PullRequest['status'], string> = {
  OPEN: 'open',
  MERGED: 'merged',
  DISCARDED: 'closed',
};

function matchesState(actual: string, expected: string): boolean {
  if (expected === 'all') {
    return true;
  }
  if (expected.startsWith('!')) {
    return actual !== expected.substring(1);
  }
  return actual === expected;
}

function mapPr(dto: PullRequest): Pr | null {
  if (dto.number === undefined || !isNonEmptyString(dto.sourceBranch)) {
    logger.trace(
      { requestId: dto.id },
      'Skipping pull request due to missing number or sourceBranch',
    );
    return null;
  }
  // Renovate only inspects its own pull requests, unless `ignorePrAuthor` is
  // configured. To cope with users rebasing a Renovate branch over the web
  // UI, PRs on `renovate/` branches are always kept.
  if (
    !config.ignorePrAuthor &&
    dto.submitterId !== undefined &&
    dto.submitterId !== botUser?.id &&
    !dto.sourceBranch.startsWith('renovate/')
  ) {
    logger.trace(
      { prNumber: dto.number },
      'Skipping pull request because it was submitted by another user',
    );
    return null;
  }
  return {
    number: dto.number,
    state: prStateMapping[dto.status],
    title: dto.title,
    bodyStruct: getPrBodyStruct(dto.description),
    sourceBranch: dto.sourceBranch,
    targetBranch: dto.targetBranch ?? '',
    createdAt: dto.submitDate ?? undefined,
    closedAt: dto.closeDate ?? undefined,
    isDraft: dto.workInProgress === true,
  };
}

function requestIdFor(prNumber: number): number | undefined {
  const requestId = config.prRequestIds.get(prNumber);
  if (requestId === undefined) {
    logger.warn(
      { prNumber },
      'Could not find the OneDev request id of the pull request',
    );
  }
  return requestId;
}

export async function fetchPrList(): Promise<Pr[]> {
  const pulls = await helper.queryPullRequests(onedevHttp);
  const prs: Pr[] = [];
  config.prRequestIds = new Map();
  for (const dto of pulls) {
    if (dto.targetProjectId !== config.projectId) {
      continue;
    }
    const pr = mapPr(dto);
    if (pr) {
      config.prRequestIds.set(pr.number, dto.id);
      prs.push(pr);
    }
  }
  logger.debug(`Retrieved ${prs.length} pull requests`);
  return prs;
}

export async function getPrList(): Promise<Pr[]> {
  config.prList ??= await fetchPrList();
  return config.prList;
}

export function invalidatePrCache(): void {
  config.prList = null;
}

export async function getPr(number: number): Promise<Pr | null> {
  const prList = await getPrList();
  const pr = prList.find((p) => p.number === number);
  if (pr) {
    logger.debug('Returning from cached PRs');
    return pr;
  }
  return null;
}

export async function findPr({
  branchName,
  prTitle: title,
  state = 'all',
  refreshCache,
}: FindPRConfig): Promise<Pr | null> {
  if (refreshCache) {
    invalidatePrCache();
  }
  logger.trace(`findPr(${branchName}, ${title ?? ''}, ${state})`);
  const prList = await getPrList();
  const pr = prList.find(
    (p) =>
      p.sourceBranch === branchName &&
      matchesState(p.state, state) &&
      (!title || p.title === title),
  );
  if (pr) {
    logger.debug(`Found PR #${pr.number}`);
    return pr;
  }
  logger.debug(`No PR found for branch ${branchName}`);
  return null;
}

export async function getBranchPr(branchName: string): Promise<Pr | null> {
  const pr = await findPr({ branchName, state: 'open' });
  return pr ? getPr(pr.number) : null;
}

async function fetchGitAuthor(user: User): Promise<string | undefined> {
  let emails: { value: string; primary: boolean }[];
  try {
    emails = await helper.getUserEmails(onedevHttp, user.id);
  } catch (err) {
    logger.debug({ err }, 'Error fetching OneDev user email addresses');
    return undefined;
  }
  const email = emails.find((e) => e.primary) ?? emails[0];
  if (!email) {
    logger.debug('OneDev user has no email address configured');
    return undefined;
  }
  return `${user.name} <${email.value}>`;
}

export async function initPlatform({
  endpoint: platformEndpoint,
  token,
  username,
}: PlatformParams): Promise<PlatformResult> {
  if (!token) {
    throw new Error(
      'Init: You must configure a OneDev token in the form `username:token-or-password`',
    );
  }

  helper.setCredentials(parseToken(token, username));

  endpoint = normalizeEndpoint(platformEndpoint ?? defaultEndpoint);
  setBaseUrl(endpoint);

  try {
    botUser = await helper.getCurrentUser(onedevHttp);
    logger.debug(
      `Authenticated as OneDev user ${botUser.name} (id ${botUser.id})`,
    );
  } catch (err) {
    logger.debug({ err }, 'Error authenticating with OneDev. Check your token');
    throw new Error('Init: Authentication failure');
  }

  const gitAuthor = await fetchGitAuthor(botUser);
  if (!gitAuthor) {
    logger.warn(
      'Cannot determine gitAuthor from OneDev - set `gitAuthor` explicitly',
    );
  }

  return {
    endpoint,
    gitAuthor,
  };
}

export async function initRepo({
  repository,
  cloneSubmodules,
  cloneSubmodulesFilter,
  gitUrl,
}: RepoParams): Promise<RepoResult> {
  config = {} as any;
  config.repository = repository;
  config.ignorePrAuthor = GlobalConfig.get('ignorePrAuthor');

  let projectId: number;
  try {
    projectId = await helper.getProjectId(onedevHttp, repository);
  } catch (err) {
    if (err.statusCode === 404) {
      logger.debug(`OneDev project ${repository} not found`);
      throw new Error(REPOSITORY_NOT_FOUND);
    }
    if (err.statusCode === 403) {
      logger.debug(`OneDev project ${repository} is not accessible`);
      throw new Error(REPOSITORY_ACCESS_FORBIDDEN);
    }
    logger.debug({ err }, 'Unknown OneDev initRepo error');
    throw err;
  }

  let project: Project;
  try {
    project = await helper.getProject(onedevHttp, projectId);
  } catch (err) {
    if (err.statusCode === 403) {
      logger.debug(`OneDev project ${repository} is not accessible`);
      throw new Error(REPOSITORY_ACCESS_FORBIDDEN);
    }
    throw err;
  }

  if (project.codeManagement !== true) {
    logger.debug('Project has code management disabled - aborting renovation');
    throw new Error(REPOSITORY_BLOCKED);
  }

  const cloneUrl = await helper.getCloneUrl(onedevHttp, projectId);
  let url: string;
  // OneDev's git-over-HTTPS needs HTTP Basic auth with the credentials used
  // for the REST API, so embed them into the URL like other platforms do.
  // (The ssh case is left untouched - it uses key-based auth.)
  const creds = helper.getCredentials();
  if (gitUrl === 'ssh') {
    if (!cloneUrl.ssh) {
      throw new Error(CONFIG_GIT_URL_UNAVAILABLE);
    }
    logger.debug(`Using SSH URL: ${cloneUrl.ssh}`);
    url = cloneUrl.ssh;
  } else {
    switch (gitUrl) {
      case 'endpoint': {
        // OneDev serves repository git urls as `<server>/<project path>.git`
        const endpointUrl = parseUrl(endpoint.replace(regEx(/~api\/?$/), ''));
        if (!endpointUrl) {
          throw new Error(CONFIG_GIT_URL_UNAVAILABLE);
        }
        endpointUrl.pathname = joinUrlParts(
          endpointUrl.pathname,
          `${repository}.git`,
        );
        logger.debug(
          { url: endpointUrl.toString() },
          'using URL based on configured endpoint',
        );
        url = endpointUrl.toString();
        break;
      }
      default:
        logger.debug(`Using HTTP URL: ${cloneUrl.http}`);
        url = cloneUrl.http;
        break;
    }

    const urlWithAuth = parseUrl(url);
    if (!urlWithAuth) {
      throw new Error(CONFIG_GIT_URL_UNAVAILABLE);
    }
    urlWithAuth.username = creds.username;
    urlWithAuth.password = creds.password;
    url = urlWithAuth.toString();
  }

  await git.initRepo({
    cloneSubmodules: !!cloneSubmodules,
    cloneSubmodulesFilter,
    url,
  });

  // OneDev does not expose the default branch over REST, so derive it from
  // the branches of the freshly initialized repository.
  const branchList = git.getBranchList();
  let defaultBranch: string | undefined;
  if (branchList.includes('main')) {
    defaultBranch = 'main';
  } else if (branchList.includes('master')) {
    defaultBranch = 'master';
  } else {
    defaultBranch = branchList[0];
  }
  if (!defaultBranch) {
    logger.debug('Project has no branches - aborting renovation');
    throw new Error(REPOSITORY_EMPTY);
  }

  config.projectId = projectId;
  config.defaultBranch = defaultBranch;
  config.isFork = project.forkedFromId !== undefined;
  config.issueList = null;
  config.issueIds = new Map();
  config.prList = null;
  config.prRequestIds = new Map();

  logger.debug(
    `OneDev project ${repository} (id ${projectId}), default branch = ${defaultBranch}`,
  );

  return {
    defaultBranch,
    isFork: config.isFork,
    repoFingerprint: repoFingerprint(projectId, endpoint),
  };
}

export async function getRepos(
  autoDiscoverConfig?: AutodiscoverConfig,
): Promise<string[]> {
  logger.debug('Auto-discovering OneDev projects');
  try {
    if (autoDiscoverConfig?.topics) {
      logger.debug(
        { topics: autoDiscoverConfig.topics },
        'Auto-discovering by topics is not supported by OneDev - ignoring',
      );
    }
    const projects = await helper.queryProjects(onedevHttp);
    let repos = projects
      .filter((p) => p.codeManagement === true)
      .map((p) => p.path);
    if (autoDiscoverConfig?.namespaces?.length) {
      repos = repos.filter((repo) =>
        autoDiscoverConfig.namespaces!.some(
          (namespace) =>
            isNonEmptyString(namespace) &&
            repo.toLowerCase().startsWith(`${namespace.toLowerCase()}/`),
        ),
      );
    }
    return repos;
  } catch (err) {
    logger.error({ err, platform: id }, 'Error auto-discovering projects');
    throw err;
  }
}

export async function createPr({
  sourceBranch,
  targetBranch,
  prTitle,
  prBody: rawBody,
  draftPR,
  platformPrOptions,
}: CreatePRConfig): Promise<Pr | null> {
  const title = prTitle;
  const body = sanitize(rawBody);
  logger.debug(
    `Creating pull request: ${title} (${sourceBranch} => ${targetBranch})`,
  );
  let requestId: number | undefined;
  try {
    requestId = await helper.createPullRequest(onedevHttp, {
      targetProjectId: config.projectId,
      sourceProjectId: config.projectId,
      targetBranch,
      sourceBranch,
      title,
      description: body,
      workInProgress: !!draftPR,
    });
  } catch (err) {
    // A PR for this branch may already exist, e.g. one resurrected from an
    // earlier run. Recover by reusing the open PR when one is found.
    invalidatePrCache();
    const existing = await findPr({ branchName: sourceBranch, state: 'open' });
    if (existing) {
      logger.warn(
        { sourceBranch },
        'OneDev returned an error when creating a PR - reusing the open PR of the branch',
      );
      if (
        existing.title !== title ||
        existing.bodyStruct?.hash !== getPrBodyStruct(body).hash
      ) {
        logger.debug('PR is outdated - updating it');
        await updatePr({
          number: existing.number,
          prTitle: title,
          prBody: body,
        });
        existing.title = title;
        existing.bodyStruct = getPrBodyStruct(body);
      }
      return existing;
    }
    throw err;
  }

  // The create call returns the new request id - use it to locate the new PR.
  invalidatePrCache();
  const prList = await getPrList();
  let pr: Pr | null | undefined = undefined;
  if (requestId !== undefined) {
    pr ??= prList.find((p) => config.prRequestIds.get(p.number) === requestId);
  }
  pr ??= await findPr({ branchName: sourceBranch, state: 'open' });
  if (!pr) {
    logger.warn(
      { sourceBranch },
      'OneDev accepted the PR creation, but the new PR could not be located',
    );
    return null;
  }

  if (platformPrOptions?.usePlatformAutomerge) {
    const requestId = config.prRequestIds.get(pr.number);
    if (requestId !== undefined) {
      try {
        const strategy =
          mergeStrategyMapping[platformPrOptions.automergeStrategy ?? 'auto'];
        if (strategy) {
          await helper.setPullRequestMergeStrategy(
            onedevHttp,
            requestId,
            strategy,
          );
        }
        await helper.setPullRequestAutoMerge(onedevHttp, requestId, {
          commitMessage: platformPrOptions.automergeCommitMessage ?? '',
          enabled: true,
        });
        logger.debug(`OneDev native automerge enabled for PR #${pr.number}`);
      } catch (err) {
        logger.warn(
          { err, prNumber: pr.number, platform: id },
          'Platform-native automerge: fail',
        );
      }
    }
  }

  return pr;
}

export async function updatePr({
  number,
  prTitle,
  prBody,
  state,
}: UpdatePrConfig): Promise<void> {
  await getPrList();
  const requestId = requestIdFor(number);
  if (requestId === undefined) {
    return;
  }
  if (prTitle) {
    await helper.setPullRequestTitle(onedevHttp, requestId, prTitle);
  }
  if (prBody) {
    await helper.setPullRequestDescription(
      onedevHttp,
      requestId,
      sanitize(prBody),
    );
  }
  if (state === 'closed') {
    await helper.discardPullRequest(onedevHttp, requestId);
  } else if (state === 'open') {
    await helper.reopenPullRequest(onedevHttp, requestId);
  }
  invalidatePrCache();
}

export async function mergePr({
  id: prNumber,
  strategy,
}: MergePRConfig): Promise<boolean> {
  await getPrList();
  const requestId = config.prRequestIds.get(prNumber);
  if (requestId === undefined) {
    logger.warn({ prNumber }, 'Cannot merge PR - request id unknown');
    return false;
  }
  try {
    const mappedStrategy = strategy
      ? mergeStrategyMapping[strategy]
      : undefined;
    if (mappedStrategy) {
      await helper.setPullRequestMergeStrategy(
        onedevHttp,
        requestId,
        mappedStrategy,
      );
    }
    await helper.mergePullRequest(onedevHttp, requestId);
    return true;
  } catch (err) {
    logger.warn({ err, prNumber }, 'Merging of PR failed');
    return false;
  }
}

export async function getBranchStatus(
  branchName: string,
  _internalChecksAsSuccess: boolean,
): Promise<BranchStatus> {
  const pr = await findPr({ branchName, state: 'open' });
  if (!pr) {
    logger.debug(`No open PR for branch ${branchName} - no builds to check`);
    return 'yellow';
  }
  const requestId = requestIdFor(pr.number);
  if (requestId === undefined) {
    return 'yellow';
  }
  let builds: Build[];
  try {
    builds = await helper.getPullRequestBuilds(onedevHttp, requestId);
  } catch (err) {
    logger.warn({ err, prNumber: pr.number }, 'Error fetching PR builds');
    return 'yellow';
  }
  logger.trace({ builds }, 'PR builds');
  if (!builds.length) {
    logger.debug(`No builds found for PR #${pr.number}`);
    return 'yellow';
  }
  let worst: BranchStatus = 'green';
  for (const build of builds) {
    const status = buildStatusMapping[build.status];
    if (status === 'red') {
      return 'red';
    }
    if (status === 'yellow') {
      worst = 'yellow';
    }
  }
  return worst;
}

export function setBranchStatus(
  _branchStatusConfig: BranchStatusConfig,
): Promise<void> {
  logger.debug(
    'OneDev does not support setting custom branch statuses over REST',
  );
  return Promise.resolve();
}

export function getBranchStatusCheck(
  _branchName: string,
  _context: string,
): Promise<BranchStatus | null> {
  logger.debug('OneDev does not support named branch status checks over REST');
  return Promise.resolve(null);
}

async function fetchIssueList(): Promise<Issue[]> {
  const issues = await helper.queryIssues(onedevHttp);
  const list: Issue[] = [];
  config.issueIds = new Map();
  for (const dto of issues) {
    if (dto.projectId !== config.projectId) {
      continue;
    }
    const issue: Issue = {
      number: dto.number,
      state: dto.state === 'Open' ? 'open' : 'closed',
      title: dto.title,
      body: dto.description ?? '',
      createdAt: dto.submitDate ?? undefined,
    };
    config.issueIds.set(dto.number, dto.id);
    list.push(issue);
  }
  logger.debug(`Retrieved ${list.length} issues`);
  return list;
}

export function getIssueList(): Promise<Issue[]> {
  config.issueList ??= fetchIssueList();
  return config.issueList;
}

export async function findIssue(title: string): Promise<Issue | null> {
  logger.trace(`findIssue(${title})`);
  const issueList = await getIssueList();
  const issue = issueList.find((i) => i.state === 'open' && i.title === title);
  if (!issue) {
    return null;
  }
  logger.debug(`Found Issue #${issue.number!}`);
  return issue;
}

function issueIdFor(issueNumber: number): number | undefined {
  const issueId = config.issueIds.get(issueNumber);
  if (issueId === undefined) {
    logger.warn({ issueNumber }, 'Could not find the OneDev id of the issue');
  }
  return issueId;
}

export async function ensureIssue({
  title,
  reuseTitle,
  body: content,
  once,
  shouldReOpen,
  confidential,
}: EnsureIssueConfig): Promise<EnsureIssueResult | null> {
  logger.trace(`ensureIssue(${title})`);
  try {
    const body = smartTruncate(content, maxBodyLength());
    const issueList = await getIssueList();
    let issues = issueList.filter((i) => i.title === title);
    if (!issues.length && reuseTitle) {
      issues = issueList.filter((i) => i.title === reuseTitle);
    }

    if (issues.length) {
      let activeIssue = issues.find((i) => i.state === 'open');

      if (!activeIssue) {
        if (once) {
          logger.debug('Issue already closed - skipping update');
          return null;
        }
        // Pick the last issue in the list as the active one
        activeIssue = issues.at(-1)!;
      }

      const issueId = issueIdFor(activeIssue.number!);
      if (issueId === undefined) {
        return null;
      }

      if (
        activeIssue.title === title &&
        activeIssue.body === body &&
        activeIssue.state === 'open'
      ) {
        logger.debug(
          `Issue #${activeIssue.number} is open and up to date - nothing to do`,
        );
        return null;
      }

      if (activeIssue.body !== body) {
        await helper.setIssueDescription(onedevHttp, issueId, body);
      }
      if (shouldReOpen && activeIssue.state !== 'open') {
        logger.debug('Reopening previously closed Issue');
        await helper.transitIssueState(onedevHttp, issueId, {
          state: 'Open',
        });
      }
      config.issueList = null;
      return 'updated';
    }

    const issueId = await helper.createIssue(onedevHttp, {
      projectId: config.projectId,
      title,
      description: body,
      confidential: !!confidential,
    });
    logger.debug(`Created new Issue id ${issueId}`);
    config.issueList = null;
    config.issueIds = new Map();

    return 'created';
  } catch (err) {
    logger.warn({ err }, 'Could not ensure issue');
  }

  return null;
}

export async function ensureIssueClosing(title: string): Promise<void> {
  logger.trace(`ensureIssueClosing(${title})`);
  const issueList = await getIssueList();
  for (const issue of issueList) {
    if (issue.state === 'open' && issue.title === title) {
      const issueId = issueIdFor(issue.number!);
      if (issueId === undefined) {
        continue;
      }
      try {
        await helper.transitIssueState(onedevHttp, issueId, {
          state: 'Closed',
        });
        logger.debug(`Closed Issue #${issue.number!}`);
      } catch (err) {
        logger.warn(
          { err, issueNumber: issue.number },
          'Could not close issue - the project may use custom issue states',
        );
      }
    }
  }
  config.issueList = null;
}

export function ensureComment({
  number,
  topic,
}: EnsureCommentConfig): Promise<boolean> {
  logger.debug(
    { prNumber: number, topic },
    'OneDev REST does not support writing pull request comments',
  );
  return Promise.resolve(false);
}

export function ensureCommentRemoval(
  _ensureCommentRemoval: EnsureCommentRemovalConfig,
): Promise<void> {
  logger.debug('OneDev REST does not support writing pull request comments');
  return Promise.resolve();
}

export async function addAssignees(
  number: number,
  assignees: string[],
): Promise<void> {
  logger.debug(`Adding assignees '${assignees.join(', ')}' to PR #${number}`);
  await getPrList();
  const requestId = requestIdFor(number);
  if (requestId === undefined) {
    return;
  }
  for (const assignee of assignees) {
    try {
      const userId = await helper.getUserId(onedevHttp, assignee);
      await helper.addPullRequestAssignee(onedevHttp, requestId, userId);
    } catch (err) {
      logger.warn({ err, number, assignee }, 'Failed to add assignee');
    }
  }
}

export async function addReviewers(
  number: number,
  reviewers: string[],
): Promise<void> {
  logger.debug(`Adding reviewers '${reviewers.join(', ')}' to PR #${number}`);
  await getPrList();
  const requestId = requestIdFor(number);
  if (requestId === undefined) {
    return;
  }
  for (const reviewer of reviewers) {
    try {
      const userId = await helper.getUserId(onedevHttp, reviewer);
      await helper.addPullRequestReviewer(onedevHttp, requestId, userId);
    } catch (err) {
      logger.warn({ err, number, reviewer }, 'Failed to add reviewer');
    }
  }
}

export function deleteLabel(_number: number, _label: string): Promise<void> {
  logger.debug('OneDev does not support pull request labels over REST');
  return Promise.resolve();
}

export function massageMarkdown(prBody: string): string {
  return smartTruncate(prBody, maxBodyLength());
}

export async function getRawFile(
  fileName: string,
  repoName?: string,
  branchOrTag?: string,
): Promise<string | null> {
  // OneDev has no file-contents REST resource; content is served from the
  // git clone. That only works for the currently initialized repository -
  // presets living in another project cannot be resolved over REST.
  if (repoName && repoName !== config.repository) {
    logger.debug(
      { repoName },
      'OneDev local presets are limited to the current repository - skipping',
    );
    return null;
  }
  return (await git.getFile(fileName, branchOrTag)) ?? null;
}

export async function getJsonFile(
  fileName: string,
  repoName?: string,
  branchOrTag?: string,
): Promise<any> {
  const raw = await getRawFile(fileName, repoName, branchOrTag);
  return parseJson(raw, fileName);
}
