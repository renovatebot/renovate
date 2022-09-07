// TODO: types (#7154)
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import URL from 'url';
import is from '@sindresorhus/is';
import delay from 'delay';
import JSON5 from 'json5';
import { DateTime } from 'luxon';
import semver from 'semver';
import { GlobalConfig } from '../../../config/global';
import { PlatformId } from '../../../constants';
import {
  PLATFORM_INTEGRATION_UNAUTHORIZED,
  REPOSITORY_ACCESS_FORBIDDEN,
  REPOSITORY_ARCHIVED,
  REPOSITORY_BLOCKED,
  REPOSITORY_CANNOT_FORK,
  REPOSITORY_CHANGED,
  REPOSITORY_DISABLED,
  REPOSITORY_EMPTY,
  REPOSITORY_FORKED,
  REPOSITORY_NOT_FOUND,
  REPOSITORY_RENAMED,
} from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { BranchStatus, PrState, VulnerabilityAlert } from '../../../types';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import * as git from '../../../util/git';
import { listCommitTree, pushCommitToRenovateRef } from '../../../util/git';
import type {
  CommitFilesConfig,
  CommitResult,
  CommitSha,
} from '../../../util/git/types';
import * as hostRules from '../../../util/host-rules';
import * as githubHttp from '../../../util/http/github';
import { regEx } from '../../../util/regex';
import { sanitize } from '../../../util/sanitize';
import { fromBase64 } from '../../../util/string';
import { ensureTrailingSlash } from '../../../util/url';
import type {
  AggregatedVulnerabilities,
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
  PlatformPrOptions,
  PlatformResult,
  RepoParams,
  RepoResult,
  UpdatePrConfig,
} from '../types';
import { repoFingerprint } from '../util';
import { smartTruncate } from '../utils/pr-body';
import { coerceRestPr } from './common';
import {
  enableAutoMergeMutation,
  getIssuesQuery,
  repoInfoQuery,
  vulnerabilityAlertsQuery,
} from './graphql';
import { massageMarkdownLinks } from './massage-markdown-links';
import { getPrCache } from './pr';
import type {
  BranchProtection,
  CombinedBranchStatus,
  Comment,
  GhAutomergeResponse,
  GhBranchStatus,
  GhPr,
  GhRepo,
  GhRestPr,
  LocalRepoConfig,
  PlatformConfig,
} from './types';
import { getUserDetails, getUserEmail } from './user';

const githubApi = new githubHttp.GithubHttp();

let config: LocalRepoConfig;
let platformConfig: PlatformConfig;

export const GitHubMaxPrBodyLen = 60000;

export function resetConfigs(): void {
  config = {} as never;
  platformConfig = {
    hostType: PlatformId.Github,
    endpoint: 'https://api.github.com/',
  };
}

resetConfigs();

function escapeHash(input: string): string {
  return input ? input.replace(regEx(/#/g), '%23') : input;
}

export async function detectGhe(token: string): Promise<void> {
  platformConfig.isGhe =
    URL.parse(platformConfig.endpoint).host !== 'api.github.com';
  if (platformConfig.isGhe) {
    const gheHeaderKey = 'x-github-enterprise-version';
    const gheQueryRes = await githubApi.headJson('/', { token });
    const gheHeaders = gheQueryRes?.headers || {};
    const [, gheVersion] =
      Object.entries(gheHeaders).find(
        ([k]) => k.toLowerCase() === gheHeaderKey
      ) ?? [];
    platformConfig.gheVersion = semver.valid(gheVersion as string) ?? null;
    logger.debug(
      `Detected GitHub Enterprise Server, version: ${platformConfig.gheVersion}`
    );
  }
}

export async function initPlatform({
  endpoint,
  token: originalToken,
  username,
  gitAuthor,
}: PlatformParams): Promise<PlatformResult> {
  let token = originalToken;
  if (!token) {
    throw new Error('Init: You must configure a GitHub token');
  }
  token = token.replace(/^ghs_/, 'x-access-token:ghs_');
  platformConfig.isGHApp = token.startsWith('x-access-token:');

  if (endpoint) {
    platformConfig.endpoint = ensureTrailingSlash(endpoint);
    githubHttp.setBaseUrl(platformConfig.endpoint);
  } else {
    logger.debug('Using default github endpoint: ' + platformConfig.endpoint);
  }

  await detectGhe(token);

  let renovateUsername: string;
  if (username) {
    renovateUsername = username;
  } else {
    platformConfig.userDetails ??= await getUserDetails(
      platformConfig.endpoint,
      token
    );
    renovateUsername = platformConfig.userDetails.username;
  }
  let discoveredGitAuthor: string | undefined;
  if (!gitAuthor) {
    platformConfig.userDetails ??= await getUserDetails(
      platformConfig.endpoint,
      token
    );
    platformConfig.userEmail ??= await getUserEmail(
      platformConfig.endpoint,
      token
    );
    if (platformConfig.userEmail) {
      discoveredGitAuthor = `${platformConfig.userDetails.name} <${platformConfig.userEmail}>`;
    }
  }
  logger.debug({ platformConfig, renovateUsername }, 'Platform config');
  const platformResult: PlatformResult = {
    endpoint: platformConfig.endpoint,
    gitAuthor: gitAuthor ?? discoveredGitAuthor,
    renovateUsername,
    token,
  };

  return platformResult;
}

// Get all repositories that the user has access to
export async function getRepos(): Promise<string[]> {
  logger.debug('Autodiscovering GitHub repositories');
  try {
    if (platformConfig.isGHApp) {
      const res = await githubApi.getJson<{
        repositories: { full_name: string }[];
      }>(`installation/repositories?per_page=100`, {
        paginationField: 'repositories',
        paginate: 'all',
      });
      return res.body.repositories
        .filter(is.nonEmptyObject)
        .map((repo) => repo.full_name);
    } else {
      const res = await githubApi.getJson<{ full_name: string }[]>(
        `user/repos?per_page=100`,
        { paginate: 'all' }
      );
      return res.body.filter(is.nonEmptyObject).map((repo) => repo.full_name);
    }
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, `GitHub getRepos error`);
    throw err;
  }
}

async function getBranchProtection(
  branchName: string
): Promise<BranchProtection> {
  // istanbul ignore if
  if (config.parentRepo) {
    return {};
  }
  const res = await githubApi.getJson<BranchProtection>(
    `repos/${config.repository}/branches/${escapeHash(branchName)}/protection`
  );
  return res.body;
}

export async function getRawFile(
  fileName: string,
  repoName?: string,
  branchOrTag?: string
): Promise<string | null> {
  const repo = repoName ?? config.repository;
  let url = `repos/${repo}/contents/${fileName}`;
  if (branchOrTag) {
    url += `?ref=` + branchOrTag;
  }
  const res = await githubApi.getJson<{ content: string }>(url);
  const buf = res.body.content;
  const str = fromBase64(buf);
  return str;
}

export async function getJsonFile(
  fileName: string,
  repoName?: string,
  branchOrTag?: string
): Promise<any | null> {
  // TODO #7154
  const raw = (await getRawFile(fileName, repoName, branchOrTag)) as string;
  return JSON5.parse(raw);
}

// Initialize GitHub by getting base branch and SHA
export async function initRepo({
  endpoint,
  repository,
  forkMode,
  forkToken,
  renovateUsername,
  cloneSubmodules,
  ignorePrAuthor,
}: RepoParams): Promise<RepoResult> {
  logger.debug(`initRepo("${repository}")`);
  // config is used by the platform api itself, not necessary for the app layer to know
  config = {
    repository,
    cloneSubmodules,
    ignorePrAuthor,
  } as any;
  // istanbul ignore if
  if (endpoint) {
    // Necessary for Renovate Pro - do not remove
    logger.debug({ endpoint }, 'Overriding default GitHub endpoint');
    platformConfig.endpoint = endpoint;
    githubHttp.setBaseUrl(endpoint);
  }
  const opts = hostRules.find({
    hostType: PlatformId.Github,
    url: platformConfig.endpoint,
  });
  config.renovateUsername = renovateUsername;
  [config.repositoryOwner, config.repositoryName] = repository.split('/');
  let repo: GhRepo | undefined;
  try {
    let infoQuery = repoInfoQuery;

    // GitHub Enterprise Server <3.3.0 doesn't support autoMergeAllowed and hasIssuesEnabled objects
    // TODO #7154
    if (
      platformConfig.isGhe &&
      // semver not null safe, accepts null and undefined
      semver.satisfies(platformConfig.gheVersion!, '<3.3.0')
    ) {
      infoQuery = infoQuery.replace(/\n\s*autoMergeAllowed\s*\n/, '\n');
      infoQuery = infoQuery.replace(/\n\s*hasIssuesEnabled\s*\n/, '\n');
    }

    const res = await githubApi.requestGraphql<{
      repository: GhRepo;
    }>(infoQuery, {
      variables: {
        owner: config.repositoryOwner,
        name: config.repositoryName,
      },
    });
    repo = res?.data?.repository;
    // istanbul ignore if
    if (!repo) {
      throw new Error(REPOSITORY_NOT_FOUND);
    }
    // istanbul ignore if
    if (!repo.defaultBranchRef?.name) {
      throw new Error(REPOSITORY_EMPTY);
    }
    if (
      repo.nameWithOwner &&
      repo.nameWithOwner.toUpperCase() !== repository.toUpperCase()
    ) {
      logger.debug(
        { repository, this_repository: repo.nameWithOwner },
        'Repository has been renamed'
      );
      throw new Error(REPOSITORY_RENAMED);
    }
    if (repo.isArchived) {
      logger.debug(
        'Repository is archived - throwing error to abort renovation'
      );
      throw new Error(REPOSITORY_ARCHIVED);
    }
    // Use default branch as PR target unless later overridden.
    config.defaultBranch = repo.defaultBranchRef.name;
    // Base branch may be configured but defaultBranch is always fixed
    logger.debug(`${repository} default branch = ${config.defaultBranch}`);
    // GitHub allows administrators to block certain types of merge, so we need to check it
    if (repo.rebaseMergeAllowed) {
      config.mergeMethod = 'rebase';
    } else if (repo.squashMergeAllowed) {
      config.mergeMethod = 'squash';
    } else if (repo.mergeCommitAllowed) {
      config.mergeMethod = 'merge';
    } else {
      // This happens if we don't have Administrator read access, it is not a critical error
      logger.debug('Could not find allowed merge methods for repo');
    }
    config.autoMergeAllowed = repo.autoMergeAllowed;
    config.hasIssuesEnabled = repo.hasIssuesEnabled;
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err }, 'Caught initRepo error');
    if (
      err.message === REPOSITORY_ARCHIVED ||
      err.message === REPOSITORY_RENAMED ||
      err.message === REPOSITORY_NOT_FOUND
    ) {
      throw err;
    }
    if (err.statusCode === 403) {
      throw new Error(REPOSITORY_ACCESS_FORBIDDEN);
    }
    if (err.statusCode === 404) {
      throw new Error(REPOSITORY_NOT_FOUND);
    }
    if (err.message.startsWith('Repository access blocked')) {
      throw new Error(REPOSITORY_BLOCKED);
    }
    if (err.message === REPOSITORY_FORKED) {
      throw err;
    }
    if (err.message === REPOSITORY_DISABLED) {
      throw err;
    }
    if (err.message === 'Response code 451 (Unavailable for Legal Reasons)') {
      throw new Error(REPOSITORY_ACCESS_FORBIDDEN);
    }
    logger.debug({ err }, 'Unknown GitHub initRepo error');
    throw err;
  }
  // This shouldn't be necessary, but occasional strange errors happened until it was added
  config.issueList = null;
  config.prList = null;

  config.forkMode = !!forkMode;
  if (forkMode) {
    logger.debug('Bot is in forkMode');
    config.forkToken = forkToken;
    // save parent name then delete
    config.parentRepo = config.repository;
    config.repository = null;
    // Get list of existing repos
    platformConfig.existingRepos ??= (
      await githubApi.getJson<{ full_name: string }[]>(
        'user/repos?per_page=100',
        {
          token: forkToken ?? opts.token,
          paginate: true,
          pageLimit: 100,
        }
      )
    ).body.map((r) => r.full_name);
    try {
      const forkedRepo = await githubApi.postJson<{
        full_name: string;
        default_branch: string;
      }>(`repos/${repository}/forks`, {
        token: forkToken ?? opts.token,
      });
      config.repository = forkedRepo.body.full_name;
      const forkDefaultBranch = forkedRepo.body.default_branch;
      if (forkDefaultBranch !== config.defaultBranch) {
        const body = {
          ref: `refs/heads/${config.defaultBranch}`,
          sha: repo.defaultBranchRef.target.oid,
        };
        logger.debug(
          {
            defaultBranch: config.defaultBranch,
            forkDefaultBranch,
            body,
          },
          'Fork has different default branch to parent, attempting to create branch'
        );
        try {
          await githubApi.postJson(`repos/${config.repository}/git/refs`, {
            body,
            token: forkToken,
          });
          logger.debug('Created new default branch in fork');
        } catch (err) /* istanbul ignore next */ {
          if (err.response?.body?.message === 'Reference already exists') {
            logger.debug(
              `Branch ${config.defaultBranch} already exists in the fork`
            );
          } else {
            logger.warn(
              { err, body: err.response?.body },
              'Could not create parent defaultBranch in fork'
            );
          }
        }
        logger.debug(
          `Setting ${config.defaultBranch} as default branch for ${config.repository}`
        );
        try {
          await githubApi.patchJson(`repos/${config.repository}`, {
            body: {
              name: config.repository.split('/')[1],
              default_branch: config.defaultBranch,
            },
            token: forkToken,
          });
          logger.debug('Successfully changed default branch for fork');
        } catch (err) /* istanbul ignore next */ {
          logger.warn({ err }, 'Could not set default branch');
        }
      }
    } catch (err) /* istanbul ignore next */ {
      logger.debug({ err }, 'Error forking repository');
      throw new Error(REPOSITORY_CANNOT_FORK);
    }
    if (platformConfig.existingRepos.includes(config.repository)) {
      logger.debug(
        { repository_fork: config.repository },
        'Found existing fork'
      );
      // This is a lovely "hack" by GitHub that lets us force update our fork's default branch
      // with the base commit from the parent repository
      const url = `repos/${config.repository}/git/refs/heads/${config.defaultBranch}`;
      const sha = repo.defaultBranchRef.target.oid;
      try {
        logger.debug(
          `Updating forked repository default sha ${sha} to match upstream`
        );
        await githubApi.patchJson(url, {
          body: {
            sha,
            force: true,
          },
          token: forkToken ?? opts.token,
        });
      } catch (err) /* istanbul ignore next */ {
        logger.warn(
          { url, sha, err: err.err || err },
          'Error updating fork from upstream - cannot continue'
        );
        if (err instanceof ExternalHostError) {
          throw err;
        }
        throw new ExternalHostError(err);
      }
    } else {
      logger.debug({ repository_fork: config.repository }, 'Created fork');
      platformConfig.existingRepos.push(config.repository);
      // Wait an arbitrary 30s to hopefully give GitHub enough time for forking to complete
      await delay(30000);
    }
  }

  const parsedEndpoint = URL.parse(platformConfig.endpoint);
  // istanbul ignore else
  if (forkMode) {
    logger.debug('Using forkToken for git init');
    parsedEndpoint.auth = config.forkToken ?? null;
  } else {
    const tokenType = opts.token?.startsWith('x-access-token:')
      ? 'app'
      : 'personal access';
    logger.debug(`Using ${tokenType} token for git init`);
    parsedEndpoint.auth = opts.token ?? null;
  }
  // TODO: null checks (#7154)
  parsedEndpoint.host = parsedEndpoint.host!.replace(
    'api.github.com',
    'github.com'
  );
  parsedEndpoint.pathname = `${config.repository}.git`;
  const url = URL.format(parsedEndpoint);
  await git.initRepo({
    ...config,
    url,
  });
  const repoConfig: RepoResult = {
    defaultBranch: config.defaultBranch,
    isFork: repo.isFork === true,
    repoFingerprint: repoFingerprint(repo.id, platformConfig.endpoint),
  };
  return repoConfig;
}

export async function getRepoForceRebase(): Promise<boolean> {
  if (config.repoForceRebase === undefined) {
    try {
      config.repoForceRebase = false;
      const branchProtection = await getBranchProtection(config.defaultBranch);
      logger.debug('Found branch protection');
      if (branchProtection.required_pull_request_reviews) {
        logger.debug(
          'Branch protection: PR Reviews are required before merging'
        );
        config.prReviewsRequired = true;
      }
      if (branchProtection.required_status_checks) {
        if (branchProtection.required_status_checks.strict) {
          logger.debug(
            'Branch protection: PRs must be up-to-date before merging'
          );
          config.repoForceRebase = true;
        }
      }
      if (branchProtection.restrictions) {
        logger.debug(
          {
            users: branchProtection.restrictions.users,
            teams: branchProtection.restrictions.teams,
          },
          'Branch protection: Pushing to branch is restricted'
        );
        config.pushProtection = true;
      }
    } catch (err) {
      if (err.statusCode === 404) {
        logger.debug(`No branch protection found`);
      } else if (
        err.message === PLATFORM_INTEGRATION_UNAUTHORIZED ||
        err.statusCode === 403
      ) {
        logger.debug(
          'Branch protection: Do not have permissions to detect branch protection'
        );
      } else {
        throw err;
      }
    }
  }
  return !!config.repoForceRebase;
}

function cachePr(pr?: GhPr | null): void {
  config.prList ??= [];
  if (pr) {
    for (let idx = 0; idx < config.prList.length; idx += 1) {
      const cachedPr = config.prList[idx];
      if (cachedPr.number === pr.number) {
        config.prList[idx] = pr;
        return;
      }
    }
    config.prList.push(pr);
  }
}

// Fetch fresh Pull Request and cache it when possible
async function fetchPr(prNo: number): Promise<GhPr | null> {
  try {
    const { body: ghRestPr } = await githubApi.getJson<GhRestPr>(
      `repos/${config.parentRepo ?? config.repository}/pulls/${prNo}`
    );
    const result = coerceRestPr(ghRestPr);
    cachePr(result);
    return result;
  } catch (err) {
    logger.warn({ err, prNo }, `GitHub fetchPr error`);
    return null;
  }
}

// Gets details for a PR
export async function getPr(prNo: number): Promise<GhPr | null> {
  if (!prNo) {
    return null;
  }
  const prList = await getPrList();
  let pr = prList.find(({ number }) => number === prNo) ?? null;
  if (pr) {
    logger.debug('Returning PR from cache');
  }
  pr ??= await fetchPr(prNo);
  return pr;
}

function matchesState(state: string, desiredState: string): boolean {
  if (desiredState === PrState.All) {
    return true;
  }
  if (desiredState.startsWith('!')) {
    return state !== desiredState.substring(1);
  }
  return state === desiredState;
}

export async function getPrList(): Promise<GhPr[]> {
  if (!config.prList) {
    const repo = config.parentRepo ?? config.repository;
    const username =
      !config.forkMode && !config.ignorePrAuthor && config.renovateUsername
        ? config.renovateUsername
        : null;
    // TODO: check null `repo` (#7154)
    const prCache = await getPrCache(githubApi, repo!, username);
    config.prList = Object.values(prCache).sort(
      ({ number: a }, { number: b }) => (a > b ? -1 : 1)
    );
  }

  return config.prList;
}

export async function findPr({
  branchName,
  prTitle,
  state = PrState.All,
}: FindPRConfig): Promise<GhPr | null> {
  logger.debug(`findPr(${branchName}, ${prTitle}, ${state})`);
  const prList = await getPrList();
  const pr = prList.find((p) => {
    if (p.sourceBranch !== branchName) {
      return false;
    }

    if (prTitle && prTitle !== p.title) {
      return false;
    }

    if (!matchesState(p.state, state)) {
      return false;
    }

    if (!config.forkMode && config.repository !== p.sourceRepo) {
      return false;
    }

    return true;
  });
  if (pr) {
    logger.debug(`Found PR #${pr.number}`);
  }
  return pr ?? null;
}

const REOPEN_THRESHOLD_MILLIS = 1000 * 60 * 60 * 24 * 7;

// Returns the Pull Request for a branch. Null if not exists.
export async function getBranchPr(branchName: string): Promise<GhPr | null> {
  logger.debug(`getBranchPr(${branchName})`);

  const openPr = await findPr({
    branchName,
    state: PrState.Open,
  });
  if (openPr) {
    return openPr;
  }

  const autoclosedPr = await findPr({
    branchName,
    state: PrState.Closed,
  });
  if (
    autoclosedPr?.title?.endsWith(' - autoclosed') &&
    autoclosedPr?.closedAt
  ) {
    const closedMillisAgo = DateTime.fromISO(autoclosedPr.closedAt)
      .diffNow()
      .negate()
      .toMillis();
    if (closedMillisAgo > REOPEN_THRESHOLD_MILLIS) {
      return null;
    }
    logger.debug({ autoclosedPr }, 'Found autoclosed PR for branch');
    if (GlobalConfig.get('dryRun')) {
      logger.info('DRY-RUN: Would try to reopen autoclosed PR');
      return null;
    }
    const { sha, number } = autoclosedPr;
    try {
      await githubApi.postJson(`repos/${config.repository}/git/refs`, {
        body: { ref: `refs/heads/${branchName}`, sha },
      });
      logger.debug({ branchName, sha }, 'Recreated autoclosed branch');
    } catch (err) {
      logger.debug('Could not recreate autoclosed branch - skipping reopen');
      return null;
    }
    try {
      const title = autoclosedPr.title.replace(regEx(/ - autoclosed$/), '');
      const { body: ghPr } = await githubApi.patchJson<GhRestPr>(
        `repos/${config.repository}/pulls/${number}`,
        {
          body: {
            state: 'open',
            title,
          },
        }
      );
      logger.info(
        { branchName, title, number },
        'Successfully reopened autoclosed PR'
      );
      const result = coerceRestPr(ghPr);
      cachePr(result);
      return result;
    } catch (err) {
      logger.debug('Could not reopen autoclosed PR');
      return null;
    }
  }
  return null;
}

async function getStatus(
  branchName: string,
  useCache = true
): Promise<CombinedBranchStatus> {
  const commitStatusUrl = `repos/${config.repository}/commits/${escapeHash(
    branchName
  )}/status`;

  return (
    await githubApi.getJson<CombinedBranchStatus>(commitStatusUrl, { useCache })
  ).body;
}

// Returns the combined status for a branch.
export async function getBranchStatus(
  branchName: string
): Promise<BranchStatus> {
  logger.debug(`getBranchStatus(${branchName})`);
  let commitStatus: CombinedBranchStatus;
  try {
    commitStatus = await getStatus(branchName);
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 404) {
      logger.debug(
        'Received 404 when checking branch status, assuming that branch has been deleted'
      );
      throw new Error(REPOSITORY_CHANGED);
    }
    logger.debug('Unknown error when checking branch status');
    throw err;
  }
  logger.debug(
    { state: commitStatus.state, statuses: commitStatus.statuses },
    'branch status check result'
  );
  let checkRuns: { name: string; status: string; conclusion: string }[] = [];
  // API is supported in oldest available GHE version 2.19
  try {
    const checkRunsUrl = `repos/${config.repository}/commits/${escapeHash(
      branchName
    )}/check-runs?per_page=100`;
    const opts = {
      headers: {
        accept: 'application/vnd.github.antiope-preview+json',
      },
      paginate: true,
      paginationField: 'check_runs',
    };
    const checkRunsRaw = (
      await githubApi.getJson<{
        check_runs: { name: string; status: string; conclusion: string }[];
      }>(checkRunsUrl, opts)
    ).body;
    if (checkRunsRaw.check_runs?.length) {
      checkRuns = checkRunsRaw.check_runs.map((run) => ({
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
      }));
      logger.debug({ checkRuns }, 'check runs result');
    } else {
      // istanbul ignore next
      logger.debug({ result: checkRunsRaw }, 'No check runs found');
    }
  } catch (err) /* istanbul ignore next */ {
    if (err instanceof ExternalHostError) {
      throw err;
    }
    if (
      err.statusCode === 403 ||
      err.message === PLATFORM_INTEGRATION_UNAUTHORIZED
    ) {
      logger.debug('No permission to view check runs');
    } else {
      logger.warn({ err }, 'Error retrieving check runs');
    }
  }
  if (checkRuns.length === 0) {
    if (commitStatus.state === 'success') {
      return BranchStatus.green;
    }
    if (commitStatus.state === 'failure') {
      return BranchStatus.red;
    }
    return BranchStatus.yellow;
  }
  if (
    commitStatus.state === 'failure' ||
    checkRuns.some((run) => run.conclusion === 'failure')
  ) {
    return BranchStatus.red;
  }
  if (
    (commitStatus.state === 'success' || commitStatus.statuses.length === 0) &&
    checkRuns.every((run) =>
      ['skipped', 'neutral', 'success'].includes(run.conclusion)
    )
  ) {
    return BranchStatus.green;
  }
  return BranchStatus.yellow;
}

async function getStatusCheck(
  branchName: string,
  useCache = true
): Promise<GhBranchStatus[]> {
  const branchCommit = git.getBranchCommit(branchName);

  const url = `repos/${config.repository}/commits/${branchCommit}/statuses`;

  return (await githubApi.getJson<GhBranchStatus[]>(url, { useCache })).body;
}

const githubToRenovateStatusMapping = {
  success: BranchStatus.green,
  error: BranchStatus.red,
  failure: BranchStatus.red,
  pending: BranchStatus.yellow,
};

export async function getBranchStatusCheck(
  branchName: string,
  context: string
): Promise<BranchStatus | null> {
  try {
    const res = await getStatusCheck(branchName);
    for (const check of res) {
      if (check.context === context) {
        return (
          githubToRenovateStatusMapping[check.state] || BranchStatus.yellow
        );
      }
    }
    return null;
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 404) {
      logger.debug('Commit not found when checking statuses');
      throw new Error(REPOSITORY_CHANGED);
    }
    throw err;
  }
}

export async function setBranchStatus({
  branchName,
  context,
  description,
  state,
  url: targetUrl,
}: BranchStatusConfig): Promise<void> {
  // istanbul ignore if
  if (config.parentRepo) {
    logger.debug('Cannot set branch status when in forking mode');
    return;
  }
  const existingStatus = await getBranchStatusCheck(branchName, context);
  if (existingStatus === state) {
    return;
  }
  logger.debug({ branch: branchName, context, state }, 'Setting branch status');
  let url: string | undefined;
  try {
    const branchCommit = git.getBranchCommit(branchName);
    url = `repos/${config.repository}/statuses/${branchCommit}`;
    const renovateToGitHubStateMapping = {
      green: 'success',
      yellow: 'pending',
      red: 'failure',
    };
    const options: any = {
      state: renovateToGitHubStateMapping[state],
      description,
      context,
    };
    if (targetUrl) {
      options.target_url = targetUrl;
    }
    await githubApi.postJson(url, { body: options });

    // update status cache
    await getStatus(branchName, false);
    await getStatusCheck(branchName, false);
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err, url }, 'Caught error setting branch status - aborting');
    throw new Error(REPOSITORY_CHANGED);
  }
}

// Issue

/* istanbul ignore next */
async function getIssues(): Promise<Issue[]> {
  const result = await githubApi.queryRepoField<Issue>(
    getIssuesQuery,
    'issues',
    {
      variables: {
        owner: config.repositoryOwner,
        name: config.repositoryName,
        user: config.renovateUsername,
      },
    }
  );

  logger.debug(`Retrieved ${result.length} issues`);
  return result.map((issue) => ({
    ...issue,
    state: issue.state?.toLowerCase(),
  }));
}

export async function getIssueList(): Promise<Issue[]> {
  // istanbul ignore if
  if (config.hasIssuesEnabled === false) {
    return [];
  }
  if (!config.issueList) {
    logger.debug('Retrieving issueList');
    config.issueList = await getIssues();
  }
  return config.issueList;
}

export async function getIssue(
  number: number,
  useCache = true
): Promise<Issue | null> {
  // istanbul ignore if
  if (config.hasIssuesEnabled === false) {
    return null;
  }
  try {
    const issueBody = (
      await githubApi.getJson<{ body: string }>(
        `repos/${config.parentRepo ?? config.repository}/issues/${number}`,
        { useCache }
      )
    ).body.body;
    return {
      number,
      body: issueBody,
    };
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err, number }, 'Error getting issue');
    return null;
  }
}

export async function findIssue(title: string): Promise<Issue | null> {
  logger.debug(`findIssue(${title})`);
  const [issue] = (await getIssueList()).filter(
    (i) => i.state === 'open' && i.title === title
  );
  if (!issue) {
    return null;
  }
  logger.debug(`Found issue ${issue.number}`);
  // TODO: can number be required? (#7154)
  return getIssue(issue.number!);
}

async function closeIssue(issueNumber: number): Promise<void> {
  logger.debug(`closeIssue(${issueNumber})`);
  await githubApi.patchJson(
    `repos/${config.parentRepo ?? config.repository}/issues/${issueNumber}`,
    {
      body: { state: 'closed' },
    }
  );
}

export async function ensureIssue({
  title,
  reuseTitle,
  body: rawBody,
  labels,
  once = false,
  shouldReOpen = true,
}: EnsureIssueConfig): Promise<EnsureIssueResult | null> {
  logger.debug(`ensureIssue(${title})`);
  // istanbul ignore if
  if (config.hasIssuesEnabled === false) {
    logger.info(
      'Cannot ensure issue because issues are disabled in this repository'
    );
    return null;
  }
  const body = sanitize(rawBody);
  try {
    const issueList = await getIssueList();
    let issues = issueList.filter((i) => i.title === title);
    if (!issues.length) {
      issues = issueList.filter((i) => i.title === reuseTitle);
      if (issues.length) {
        logger.debug({ reuseTitle, title }, 'Reusing issue title');
      }
    }
    if (issues.length) {
      let issue = issues.find((i) => i.state === 'open');
      if (!issue) {
        if (once) {
          logger.debug('Issue already closed - skipping recreation');
          return null;
        }
        if (shouldReOpen) {
          logger.debug('Reopening previously closed issue');
        }
        issue = issues[issues.length - 1];
      }
      for (const i of issues) {
        if (i.state === 'open' && i.number !== issue.number) {
          logger.warn(`Closing duplicate issue ${i.number}`);
          // TODO #7154
          await closeIssue(i.number!);
        }
      }
      const issueBody = (
        await githubApi.getJson<{ body: string }>(
          `repos/${config.parentRepo ?? config.repository}/issues/${
            issue.number
          }`
        )
      ).body.body;
      if (
        issue.title === title &&
        issueBody === body &&
        issue.state === 'open'
      ) {
        logger.debug('Issue is open and up to date - nothing to do');
        return null;
      }
      if (shouldReOpen) {
        logger.debug('Patching issue');
        const data: Record<string, unknown> = { body, state: 'open', title };
        if (labels) {
          data.labels = labels;
        }
        await githubApi.patchJson(
          `repos/${config.parentRepo ?? config.repository}/issues/${
            issue.number
          }`,
          {
            body: data,
          }
        );
        logger.debug('Issue updated');
        return 'updated';
      }
    }
    await githubApi.postJson(
      `repos/${config.parentRepo ?? config.repository}/issues`,
      {
        body: {
          title,
          body,
          labels: labels ?? [],
        },
      }
    );
    logger.info('Issue created');
    // reset issueList so that it will be fetched again as-needed
    config.issueList = null;
    return 'created';
  } catch (err) /* istanbul ignore next */ {
    if (err.body?.message?.startsWith('Issues are disabled for this repo')) {
      logger.debug(`Issues are disabled, so could not create issue: ${title}`);
    } else {
      logger.warn({ err }, 'Could not ensure issue');
    }
  }
  return null;
}

export async function ensureIssueClosing(title: string): Promise<void> {
  logger.trace(`ensureIssueClosing(${title})`);
  // istanbul ignore if
  if (config.hasIssuesEnabled === false) {
    logger.info(
      'Cannot ensure issue because issues are disabled in this repository'
    );
    return;
  }
  const issueList = await getIssueList();
  for (const issue of issueList) {
    if (issue.state === 'open' && issue.title === title) {
      // TODO #7154
      await closeIssue(issue.number!);
      logger.debug({ number: issue.number }, 'Issue closed');
    }
  }
}

export async function addAssignees(
  issueNo: number,
  assignees: string[]
): Promise<void> {
  logger.debug(`Adding assignees '${assignees.join(', ')}' to #${issueNo}`);
  const repository = config.parentRepo ?? config.repository;
  await githubApi.postJson(`repos/${repository}/issues/${issueNo}/assignees`, {
    body: {
      assignees,
    },
  });
}

export async function addReviewers(
  prNo: number,
  reviewers: string[]
): Promise<void> {
  logger.debug(`Adding reviewers '${reviewers.join(', ')}' to #${prNo}`);

  const userReviewers = reviewers.filter((e) => !e.startsWith('team:'));
  const teamReviewers = reviewers
    .filter((e) => e.startsWith('team:'))
    .map((e) => e.replace(regEx(/^team:/), ''));
  try {
    await githubApi.postJson(
      `repos/${
        config.parentRepo ?? config.repository
      }/pulls/${prNo}/requested_reviewers`,
      {
        body: {
          reviewers: userReviewers,
          team_reviewers: teamReviewers,
        },
      }
    );
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Failed to assign reviewer');
  }
}

async function addLabels(
  issueNo: number,
  labels: string[] | null | undefined
): Promise<void> {
  logger.debug(`Adding labels '${labels?.join(', ')}' to #${issueNo}`);
  const repository = config.parentRepo ?? config.repository;
  if (is.array(labels) && labels.length) {
    await githubApi.postJson(`repos/${repository}/issues/${issueNo}/labels`, {
      body: labels,
    });
  }
}

export async function deleteLabel(
  issueNo: number,
  label: string
): Promise<void> {
  logger.debug(`Deleting label ${label} from #${issueNo}`);
  const repository = config.parentRepo ?? config.repository;
  try {
    await githubApi.deleteJson(
      `repos/${repository}/issues/${issueNo}/labels/${label}`
    );
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err, issueNo, label }, 'Failed to delete label');
  }
}

async function addComment(issueNo: number, body: string): Promise<void> {
  // POST /repos/:owner/:repo/issues/:number/comments
  await githubApi.postJson(
    `repos/${
      config.parentRepo ?? config.repository
    }/issues/${issueNo}/comments`,
    {
      body: { body },
    }
  );
}

async function editComment(commentId: number, body: string): Promise<void> {
  // PATCH /repos/:owner/:repo/issues/comments/:id
  await githubApi.patchJson(
    `repos/${
      config.parentRepo ?? config.repository
    }/issues/comments/${commentId}`,
    {
      body: { body },
    }
  );
}

async function deleteComment(commentId: number): Promise<void> {
  // DELETE /repos/:owner/:repo/issues/comments/:id
  await githubApi.deleteJson(
    `repos/${
      config.parentRepo ?? config.repository
    }/issues/comments/${commentId}`
  );
}

async function getComments(issueNo: number): Promise<Comment[]> {
  // GET /repos/:owner/:repo/issues/:number/comments
  logger.debug(`Getting comments for #${issueNo}`);
  const url = `repos/${
    config.parentRepo ?? config.repository
  }/issues/${issueNo}/comments?per_page=100`;
  try {
    const comments = (
      await githubApi.getJson<Comment[]>(url, {
        paginate: true,
      })
    ).body;
    logger.debug(`Found ${comments.length} comments`);
    return comments;
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 404) {
      logger.debug('404 response when retrieving comments');
      throw new ExternalHostError(err, PlatformId.Github);
    }
    throw err;
  }
}

export async function ensureComment({
  number,
  topic,
  content,
}: EnsureCommentConfig): Promise<boolean> {
  const sanitizedContent = sanitize(content);
  try {
    const comments = await getComments(number);
    let body: string;
    let commentId: number | null = null;
    let commentNeedsUpdating = false;
    if (topic) {
      logger.debug(`Ensuring comment "${topic}" in #${number}`);
      body = `### ${topic}\n\n${sanitizedContent}`;
      comments.forEach((comment) => {
        if (comment.body.startsWith(`### ${topic}\n\n`)) {
          commentId = comment.id;
          commentNeedsUpdating = comment.body !== body;
        }
      });
    } else {
      logger.debug(`Ensuring content-only comment in #${number}`);
      body = `${sanitizedContent}`;
      comments.forEach((comment) => {
        if (comment.body === body) {
          commentId = comment.id;
          commentNeedsUpdating = false;
        }
      });
    }
    if (!commentId) {
      await addComment(number, body);
      logger.info(
        { repository: config.repository, issueNo: number, topic },
        'Comment added'
      );
    } else if (commentNeedsUpdating) {
      await editComment(commentId, body);
      logger.debug(
        { repository: config.repository, issueNo: number },
        'Comment updated'
      );
    } else {
      logger.debug('Comment is already update-to-date');
    }
    return true;
  } catch (err) /* istanbul ignore next */ {
    if (err instanceof ExternalHostError) {
      throw err;
    }
    if (err.body?.message?.includes('is locked')) {
      logger.debug('Issue is locked - cannot add comment');
    } else {
      logger.warn({ err }, 'Error ensuring comment');
    }
    return false;
  }
}

export async function ensureCommentRemoval(
  deleteConfig: EnsureCommentRemovalConfig
): Promise<void> {
  const { number: issueNo } = deleteConfig;
  const key =
    deleteConfig.type === 'by-topic'
      ? deleteConfig.topic
      : deleteConfig.content;
  logger.trace(`Ensuring comment "${key}" in #${issueNo} is removed`);
  const comments = await getComments(issueNo);
  let commentId: number | null | undefined = null;

  if (deleteConfig.type === 'by-topic') {
    const byTopic = (comment: Comment): boolean =>
      comment.body.startsWith(`### ${deleteConfig.topic}\n\n`);
    commentId = comments.find(byTopic)?.id;
  } else if (deleteConfig.type === 'by-content') {
    const byContent = (comment: Comment): boolean =>
      comment.body.trim() === deleteConfig.content;
    commentId = comments.find(byContent)?.id;
  }

  try {
    if (commentId) {
      logger.debug({ issueNo }, 'Removing comment');
      await deleteComment(commentId);
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error deleting comment');
  }
}

// Pull Request

async function tryPrAutomerge(
  prNumber: number,
  prNodeId: string,
  platformOptions: PlatformPrOptions | undefined
): Promise<void> {
  if (!platformOptions?.usePlatformAutomerge) {
    return;
  }

  // If GitHub Enterprise Server <3.3.0 it doesn't support automerge
  // TODO #7154
  if (platformConfig.isGhe) {
    // semver not null safe, accepts null and undefined
    if (semver.satisfies(platformConfig.gheVersion!, '<3.3.0')) {
      logger.debug(
        { prNumber },
        'GitHub-native automerge: not supported on this version of GHE. Use 3.3.0 or newer.'
      );
      return;
    }
  }

  if (!config.autoMergeAllowed) {
    logger.debug(
      { prNumber },
      'GitHub-native automerge: not enabled in repo settings'
    );
    return;
  }

  try {
    const mergeMethod = config.mergeMethod?.toUpperCase() || 'MERGE';
    const variables = { pullRequestId: prNodeId, mergeMethod };
    const queryOptions = { variables };

    const res = await githubApi.requestGraphql<GhAutomergeResponse>(
      enableAutoMergeMutation,
      queryOptions
    );

    if (res?.errors) {
      logger.debug(
        { prNumber, errors: res.errors },
        'GitHub-native automerge: fail'
      );
      return;
    }

    logger.debug({ prNumber }, 'GitHub-native automerge: success');
  } catch (err) /* istanbul ignore next: missing test #7154 */ {
    logger.warn({ prNumber, err }, 'GitHub-native automerge: REST API error');
  }
}

// Creates PR and returns PR number
export async function createPr({
  sourceBranch,
  targetBranch,
  prTitle: title,
  prBody: rawBody,
  labels,
  draftPR = false,
  platformOptions,
}: CreatePRConfig): Promise<GhPr | null> {
  const body = sanitize(rawBody);
  const base = targetBranch;
  // Include the repository owner to handle forkMode and regular mode
  // TODO: can `repository` be null? (#7154)

  const head = `${config.repository!.split('/')[0]}:${sourceBranch}`;
  const options: any = {
    body: {
      title,
      head,
      base,
      body,
      draft: draftPR,
    },
  };
  // istanbul ignore if
  if (config.forkToken) {
    options.token = config.forkToken;
    options.body.maintainer_can_modify = true;
  }
  logger.debug({ title, head, base, draft: draftPR }, 'Creating PR');
  const ghPr = (
    await githubApi.postJson<GhRestPr>(
      `repos/${config.parentRepo ?? config.repository}/pulls`,
      options
    )
  ).body;
  logger.debug(
    { branch: sourceBranch, pr: ghPr.number, draft: draftPR },
    'PR created'
  );
  const { number, node_id } = ghPr;
  await addLabels(number, labels);
  await tryPrAutomerge(number, node_id, platformOptions);
  const result = coerceRestPr(ghPr);
  cachePr(result);
  return result;
}

export async function updatePr({
  number: prNo,
  prTitle: title,
  prBody: rawBody,
  state,
}: UpdatePrConfig): Promise<void> {
  logger.debug(`updatePr(${prNo}, ${title}, body)`);
  const body = sanitize(rawBody);
  const patchBody: any = { title };
  if (body) {
    patchBody.body = body;
  }
  if (state) {
    patchBody.state = state;
  }
  const options: any = {
    body: patchBody,
  };
  // istanbul ignore if
  if (config.forkToken) {
    options.token = config.forkToken;
  }
  try {
    const { body: ghPr } = await githubApi.patchJson<GhRestPr>(
      `repos/${config.parentRepo ?? config.repository}/pulls/${prNo}`,
      options
    );
    const result = coerceRestPr(ghPr);
    cachePr(result);
    logger.debug({ pr: prNo }, 'PR updated');
  } catch (err) /* istanbul ignore next */ {
    if (err instanceof ExternalHostError) {
      throw err;
    }
    logger.warn({ err }, 'Error updating PR');
  }
}

export async function mergePr({
  branchName,
  id: prNo,
}: MergePRConfig): Promise<boolean> {
  logger.debug(`mergePr(${prNo}, ${branchName})`);
  // istanbul ignore if
  if (config.prReviewsRequired) {
    logger.debug(
      { branch: branchName, prNo },
      'Branch protection: Attempting to merge PR when PR reviews are enabled'
    );
    const repository = config.parentRepo ?? config.repository;
    const reviews = await githubApi.getJson<{ state: string }[]>(
      `repos/${repository}/pulls/${prNo}/reviews`
    );
    const isApproved = reviews.body.some(
      (review) => review.state === 'APPROVED'
    );
    if (!isApproved) {
      logger.debug(
        { branch: branchName, prNo },
        'Branch protection: Cannot automerge PR until there is an approving review'
      );
      return false;
    }
    logger.debug('Found approving reviews');
  }
  const url = `repos/${
    config.parentRepo ?? config.repository
  }/pulls/${prNo}/merge`;
  const options: any = {
    body: {} as { merge_method?: string },
  };
  // istanbul ignore if
  if (config.forkToken) {
    options.token = config.forkToken;
  }
  let automerged = false;
  let automergeResult: any;
  if (config.mergeMethod) {
    // This path is taken if we have auto-detected the allowed merge types from the repo
    options.body.merge_method = config.mergeMethod;
    try {
      logger.debug({ options, url }, `mergePr`);
      automergeResult = await githubApi.putJson(url, options);
      automerged = true;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 405) {
        // istanbul ignore next
        logger.debug(
          { response: err.response ? err.response.body : undefined },
          'GitHub blocking PR merge -- will keep trying'
        );
      } else {
        logger.warn({ err }, `Failed to ${config.mergeMethod} merge PR`);
        return false;
      }
    }
  }
  if (!automerged) {
    // We need to guess the merge method and try squash -> rebase -> merge
    options.body.merge_method = 'rebase';
    try {
      logger.debug({ options, url }, `mergePr`);
      automergeResult = await githubApi.putJson(url, options);
    } catch (err1) {
      logger.debug({ err: err1 }, `Failed to rebase merge PR`);
      try {
        options.body.merge_method = 'squash';
        logger.debug({ options, url }, `mergePr`);
        automergeResult = await githubApi.putJson(url, options);
      } catch (err2) {
        logger.debug({ err: err2 }, `Failed to merge squash PR`);
        try {
          options.body.merge_method = 'merge';
          logger.debug({ options, url }, `mergePr`);
          automergeResult = await githubApi.putJson(url, options);
        } catch (err3) {
          logger.debug({ err: err3 }, `Failed to merge commit PR`);
          logger.info({ pr: prNo }, 'All merge attempts failed');
          return false;
        }
      }
    }
  }
  logger.debug(
    { automergeResult: automergeResult.body, pr: prNo },
    'PR merged'
  );
  const cachedPr = config.prList?.find(({ number }) => number === prNo);
  if (cachedPr) {
    cachePr({ ...cachedPr, state: PrState.Merged });
  }
  return true;
}

export function massageMarkdown(input: string): string {
  if (platformConfig.isGhe) {
    return smartTruncate(input, GitHubMaxPrBodyLen);
  }
  const massagedInput = massageMarkdownLinks(input)
    // to be safe, replace all github.com links with renovatebot redirector
    .replace(
      regEx(/href="https?:\/\/github.com\//g),
      'href="https://togithub.com/'
    )
    .replace(regEx(/]\(https:\/\/github\.com\//g), '](https://togithub.com/')
    .replace(regEx(/]: https:\/\/github\.com\//g), ']: https://togithub.com/');
  return smartTruncate(massagedInput, GitHubMaxPrBodyLen);
}

export async function getVulnerabilityAlerts(): Promise<VulnerabilityAlert[]> {
  let vulnerabilityAlerts: { node: VulnerabilityAlert }[] | undefined;

  // TODO #7154
  const gheSupportsStateFilter = semver.satisfies(
    // semver not null safe, accepts null and undefined

    platformConfig.gheVersion!,
    '>=3.5'
  );
  const filterByState = !platformConfig.isGhe || gheSupportsStateFilter;
  const query = vulnerabilityAlertsQuery(filterByState);

  try {
    vulnerabilityAlerts = await githubApi.queryRepoField<{
      node: VulnerabilityAlert;
    }>(query, 'vulnerabilityAlerts', {
      variables: { owner: config.repositoryOwner, name: config.repositoryName },
      paginate: false,
      acceptHeader: 'application/vnd.github.vixen-preview+json',
    });
  } catch (err) {
    logger.debug({ err }, 'Error retrieving vulnerability alerts');
    logger.warn(
      {
        url: 'https://docs.renovatebot.com/configuration-options/#vulnerabilityalerts',
      },
      'Cannot access vulnerability alerts. Please ensure permissions have been granted.'
    );
  }
  let alerts: VulnerabilityAlert[] = [];
  try {
    if (vulnerabilityAlerts?.length) {
      alerts = vulnerabilityAlerts.map((edge) => edge.node);
      const shortAlerts: AggregatedVulnerabilities = {};
      if (alerts.length) {
        logger.trace({ alerts }, 'GitHub vulnerability details');
        for (const alert of alerts) {
          if (alert.securityVulnerability === null) {
            // As described in the documentation, there are cases in which
            // GitHub API responds with `"securityVulnerability": null`.
            // But it's may be faulty, so skip processing it here.
            continue;
          }
          const {
            package: { name, ecosystem },
            vulnerableVersionRange,
            firstPatchedVersion,
          } = alert.securityVulnerability;
          const patch = firstPatchedVersion?.identifier;

          const key = `${ecosystem.toLowerCase()}/${name}`;
          const range = vulnerableVersionRange;
          const elem = shortAlerts[key] || {};
          elem[range] = patch ?? null;
          shortAlerts[key] = elem;
        }
        logger.debug({ alerts: shortAlerts }, 'GitHub vulnerability details');
      }
    } else {
      logger.debug('No vulnerability alerts found');
    }
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, 'Error processing vulnerabity alerts');
  }
  return alerts;
}

async function pushFiles(
  { branchName, message }: CommitFilesConfig,
  { parentCommitSha, commitSha }: CommitResult
): Promise<CommitSha | null> {
  try {
    // Push the commit to GitHub using a custom ref
    // The associated blobs will be pushed automatically
    await pushCommitToRenovateRef(commitSha, branchName);
    // Get all the blobs which the commit/tree points to
    // The blob SHAs will be the same locally as on GitHub
    const treeItems = await listCommitTree(commitSha);

    // For reasons unknown, we need to recreate our tree+commit on GitHub
    // Attempting to reuse the tree or commit SHA we pushed does not work
    const treeRes = await githubApi.postJson<{ sha: string }>(
      `/repos/${config.repository}/git/trees`,
      { body: { tree: treeItems } }
    );
    const treeSha = treeRes.body.sha;

    // Now we recreate the commit using the tree we recreated the step before
    const commitRes = await githubApi.postJson<{ sha: string }>(
      `/repos/${config.repository}/git/commits`,
      { body: { message, tree: treeSha, parents: [parentCommitSha] } }
    );
    const remoteCommitSha = commitRes.body.sha;

    // Create branch if it didn't already exist, update it otherwise
    if (git.branchExists(branchName)) {
      // This is the equivalent of a git force push
      // We are using this REST API because the GraphQL API doesn't support force push
      await githubApi.patchJson(
        `/repos/${config.repository}/git/refs/heads/${branchName}`,
        { body: { sha: remoteCommitSha, force: true } }
      );
    } else {
      await githubApi.postJson(`/repos/${config.repository}/git/refs`, {
        body: { ref: `refs/heads/${branchName}`, sha: remoteCommitSha },
      });
    }

    return remoteCommitSha;
  } catch (err) {
    logger.debug({ branchName, err }, 'Platform-native commit: unknown error');
    return null;
  }
}

export async function commitFiles(
  config: CommitFilesConfig
): Promise<CommitSha | null> {
  const commitResult = await git.prepareCommit(config); // Commit locally and don't push
  const { branchName, files } = config;
  if (!commitResult) {
    logger.debug(
      { branchName, files: files.map(({ path }) => path) },
      `Platform-native commit: unable to prepare for commit`
    );
    return null;
  }
  // Perform the commits using REST API
  const pushResult = await pushFiles(config, commitResult);
  if (!pushResult) {
    return null;
  }
  // Replace locally created branch with the remotely created one
  // and return the remote commit SHA
  await git.resetToCommit(commitResult.parentCommitSha);
  const commitSha = await git.fetchCommit(config);
  return commitSha;
}
