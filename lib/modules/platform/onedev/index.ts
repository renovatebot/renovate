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
import { fromBase64 } from '../../../util/string.ts';
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
import type {
  Build,
  Project,
  PullRequest,
  PullRequestComment,
  User,
} from './schema.ts';
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
  /** Repository path -> project id, cached for cross-repository file access. */
  rawFileProjectIds: Map<string, number>;
  /** Project id -> default branch, cached across reads within a run. */
  defaultBranches: Map<number, string>;
}

export const id = 'onedev';

export const experimental = true;

export const onedevHttp = new OnedevHttp();

const defaultEndpoint = 'https://onedev.example.com/';

let endpoint = defaultEndpoint;

let config: OneDevRepoConfig = {} as any;

let botUser: User | undefined;
let botUserId: number;

export function maxBodyLength(): number {
  return 100000;
}

export function resetPlatform(): void {
  config = {} as any;
  botUser = undefined;
  // gitea-style reset for the module-level id (mirrors `botUserID` there)
  botUserId = undefined as never;
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
 * OneDev authenticates REST and git-over-HTTPS requests with HTTP Basic
 * auth. The `password` (or `token`) option carries an access token or
 * account password, and the `username` option carries the OneDev user name.
 * When no username is set, `user` is assumed, which OneDev accepts for
 * personal access tokens. The token is used as-is; no combined
 * `username:token` form is parsed, mirroring the other platform modules.
 */
function resolveCredentials(
  token: string | undefined,
  username: string | undefined,
  password: string | undefined,
): OneDevCredentials {
  const credential = password ?? token;
  if (!credential) {
    throw new Error(
      'Init: You must configure a OneDev access token via the `token` or `password` option',
    );
  }
  if (isNonEmptyString(username)) {
    return { username, password: credential };
  }
  logger.debug(
    'No OneDev username configured - defaulting to `user`, which OneDev accepts for personal access tokens',
  );
  return { username: 'user', password: credential };
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

const rebaseCheckboxLineRe = regEx(
  /^(?<prefix>\s*-\s\[[ x]\])\s+(?<text>If you want to rebase\/retry this PR, (?:check this box|click this checkbox))(?<dot>\.)?$/m,
);

/**
 * OneDev's PR description editor re-saves the description without HTML
 * comments (and with normalized list indentation). That could strip Renovate's
 * `- [ ] <!-- rebase-check -->` marker, which the repository worker relies on
 * to detect a ticked rebase checkbox. Restore the marker when the checkbox
 * line is still recognizable so the state survives the round trip.
 */
export function restoreRebaseCheckMarker(
  description: string | null | undefined,
): string | null | undefined {
  if (!description) {
    return description;
  }
  return description.replace(
    rebaseCheckboxLineRe,
    '$<prefix> <!-- rebase-check -->$<text>$<dot>',
  );
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
    bodyStruct: getPrBodyStruct(restoreRebaseCheckMarker(dto.description)),
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
  password,
}: PlatformParams): Promise<PlatformResult> {
  helper.setCredentials(resolveCredentials(token, username, password));

  endpoint = normalizeEndpoint(platformEndpoint ?? defaultEndpoint);
  setBaseUrl(endpoint);

  try {
    botUser = await helper.getCurrentUser(onedevHttp);
    botUserId = botUser.id;
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

/**
 * OneDev exposes the default branch over REST (`GET /repositories/{id}/default-branch`,
 * which answers 204 when the repository is not initialized). Fall back to the
 * branch list of the freshly initialized git clone when the REST endpoint is
 * unavailable (older OneDev versions, or an uninitialized repository).
 */
async function determineDefaultBranch(
  projectId: number,
): Promise<string | undefined> {
  config.defaultBranches ??= new Map();
  const cached = config.defaultBranches.get(projectId);
  if (cached) {
    return cached;
  }
  try {
    const branch = await helper.getDefaultBranch(onedevHttp, projectId);
    if (branch) {
      config.defaultBranches.set(projectId, branch);
      return branch;
    }
  } catch (err) {
    logger.debug(
      { err, projectId },
      'Error reading the default branch from OneDev REST - falling back to the branch list',
    );
  }
  const branchList = git.getBranchList();
  for (const candidate of ['main', 'master']) {
    if (branchList.includes(candidate)) {
      return candidate;
    }
  }
  return branchList[0];
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
        // The endpoint has been dereferenced by initPlatform() already, so a
        // parse failure is not reachable in practice.
        /* v8 ignore next -- the endpoint is always dereferencable here */
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

  const defaultBranch = await determineDefaultBranch(projectId);
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
  config.rawFileProjectIds = new Map();

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
  const byRequestId = prList.find(
    (p) => config.prRequestIds.get(p.number) === requestId,
  );
  const pr = await (byRequestId
    ? Promise.resolve(byRequestId)
    : findPr({ branchName: sourceBranch, state: 'open' }));
  if (!pr) {
    logger.warn(
      { sourceBranch },
      'OneDev accepted the PR creation, but the new PR could not be located',
    );
    return null;
  }

  if (platformPrOptions?.usePlatformAutomerge) {
    // The request id map is always filled together with the PR list.
    const requestId = config.prRequestIds.get(pr.number)!;
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
  // config.prList and config.prRequestIds are filled together in
  // fetchPrList(), so the request id always resolves here.
  /* v8 ignore next -- the request id map is always filled together with the PR list */
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
  // fetchIssueList() fills config.issueIds for every issue it returns, so
  // the lookup always succeeds for an issue coming from that list.
  /* v8 ignore next -- issues and their ids are always fetched together */
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
      // fetchIssueList() fills config.issueIds for every issue it returns.
      /* v8 ignore next -- issues and their ids are always fetched together */
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

    const fields = await helper.getIssueFieldDefaults(onedevHttp);
    const issueId = await helper.createIssue(onedevHttp, {
      projectId: config.projectId,
      title,
      description: body,
      confidential: !!confidential,
      fields: Object.keys(fields).length ? fields : undefined,
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
      // fetchIssueList() fills config.issueIds for every issue it returns.
      /* v8 ignore next -- issues and their ids are always fetched together */
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

function findCommentByTopic(
  comments: PullRequestComment[],
  topic: string,
): PullRequestComment | null {
  return (
    comments.find((c) => c.content?.startsWith(`### ${topic}\n\n`)) ?? null
  );
}

function findCommentByContent(
  comments: PullRequestComment[],
  content: string,
): PullRequestComment | null {
  return comments.find((c) => c.content?.trim() === content.trim()) ?? null;
}

export async function ensureComment({
  number,
  topic,
  content,
}: EnsureCommentConfig): Promise<boolean> {
  try {
    logger.debug(`Ensuring comment "${topic ?? content}" in PR #${number}`);
    await getPrList();
    const requestId = requestIdFor(number);
    if (requestId === undefined) {
      return false;
    }
    const body = sanitize(content);
    const commentList = await helper.getPullRequestComments(
      onedevHttp,
      requestId,
    );

    let comment: PullRequestComment | null;
    let commentBody = body;
    if (topic) {
      comment = findCommentByTopic(commentList, topic);
      commentBody = `### ${topic}\n\n${body}`;
    } else {
      comment = findCommentByContent(commentList, body);
    }

    if (!comment) {
      const commentId = await helper.createPullRequestComment(onedevHttp, {
        requestId,
        userId: botUserId,
        content: commentBody,
      });
      logger.debug(`Added pull request comment id ${commentId}`);
    } else if (comment.content === commentBody) {
      logger.debug(`Comment #${comment.id} is already up-to-date`);
    } else {
      await helper.updatePullRequestComment(
        onedevHttp,
        comment.id,
        commentBody,
      );
      logger.debug(`Comment #${comment.id} updated`);
    }
    return true;
  } catch (err) {
    logger.warn({ err, number, subject: topic }, 'Error ensuring comment');
    return false;
  }
}

export async function ensureCommentRemoval(
  deleteConfig: EnsureCommentRemovalConfig,
): Promise<void> {
  const { number } = deleteConfig;
  logger.debug(`Ensuring removal of comment in PR #${number} removed`);
  await getPrList();
  const requestId = requestIdFor(number);
  if (requestId === undefined) {
    return;
  }
  try {
    const commentList = await helper.getPullRequestComments(
      onedevHttp,
      requestId,
    );
    let comment: PullRequestComment | null = null;
    if (deleteConfig.type === 'by-topic') {
      comment = findCommentByTopic(commentList, deleteConfig.topic);
    } else {
      // `by-content` is the only other removal type
      const body = sanitize(deleteConfig.content);
      comment = findCommentByContent(commentList, body);
    }
    if (!comment) {
      logger.debug(`Comment not found in PR #${number}, nothing to remove`);
      return;
    }
    await helper.deletePullRequestComment(onedevHttp, comment.id);
    logger.debug(`Removed pull request comment id ${comment.id}`);
  } catch (err) {
    logger.warn({ err, number }, 'Error removing comment');
  }
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
  const repository = repoName ?? config.repository;
  // Content of the currently initialized repository is served from the git
  // clone; other projects are read over REST, so that e.g. config presets
  // living in a shared parent project can be resolved.
  if (repository === config.repository) {
    return (await git.getFile(fileName, branchOrTag)) ?? null;
  }
  const projectId = await getRawFileProjectId(repository);
  if (projectId === undefined) {
    return null;
  }
  const revision =
    branchOrTag ?? (await determineDefaultBranch(projectId)) ?? undefined;
  if (!revision) {
    logger.debug(
      { repository, fileName },
      'Cannot determine a revision for the remote file read',
    );
    return null;
  }
  try {
    const file = await helper.getRepositoryFile(
      onedevHttp,
      projectId,
      fileName,
      revision,
    );
    if (!file.base64Content) {
      return null;
    }
    return fromBase64(file.base64Content);
  } catch (err) {
    logger.debug(
      { err, repository, projectId, fileName, revision },
      'Could not read file contents over the OneDev REST API',
    );
    return null;
  }
}

async function getRawFileProjectId(
  repoName: string,
): Promise<number | undefined> {
  let projectId = config.rawFileProjectIds?.get(repoName);
  if (projectId !== undefined) {
    return projectId;
  }
  try {
    projectId = await helper.getProjectId(onedevHttp, repoName);
  } catch (err) {
    logger.debug(
      { err, repoName },
      'Could not resolve the project id for remote file access',
    );
    return undefined;
  }
  config.rawFileProjectIds?.set(repoName, projectId);
  return projectId;
}

export async function getJsonFile(
  fileName: string,
  repoName?: string,
  branchOrTag?: string,
): Promise<any> {
  const raw = await getRawFile(fileName, repoName, branchOrTag);
  return parseJson(raw, fileName);
}
