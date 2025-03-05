import URL from 'node:url';
import { setTimeout } from 'timers/promises';
import is from '@sindresorhus/is';
import semver from 'semver';
import {
  PLATFORM_INTEGRATION_UNAUTHORIZED,
  PLATFORM_RATE_LIMIT_EXCEEDED,
  PLATFORM_UNKNOWN_ERROR,
  REPOSITORY_ACCESS_FORBIDDEN,
  REPOSITORY_ARCHIVED,
  REPOSITORY_BLOCKED,
  REPOSITORY_CANNOT_FORK,
  REPOSITORY_CHANGED,
  REPOSITORY_DISABLED,
  REPOSITORY_EMPTY,
  REPOSITORY_FORKED,
  REPOSITORY_FORK_MISSING,
  REPOSITORY_FORK_MODE_FORKED,
  REPOSITORY_NOT_FOUND,
  REPOSITORY_RENAMED,
} from '../../../constants/error-messages';
import { logger } from '../../../logger';
import type { BranchStatus, VulnerabilityAlert } from '../../../types';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { isGithubFineGrainedPersonalAccessToken } from '../../../util/check-token';
import { coerceToNull } from '../../../util/coerce';
import { parseJson } from '../../../util/common';
import * as git from '../../../util/git';
import { listCommitTree, pushCommitToRenovateRef } from '../../../util/git';
import type {
  CommitFilesConfig,
  CommitResult,
  LongCommitSha,
} from '../../../util/git/types';
import * as hostRules from '../../../util/host-rules';
import { repoCacheProvider } from '../../../util/http/cache/repository-http-cache-provider';
import * as githubHttp from '../../../util/http/github';
import type { GithubHttpOptions } from '../../../util/http/github';
import type { HttpResponse } from '../../../util/http/types';
import { coerceObject } from '../../../util/object';
import { regEx } from '../../../util/regex';
import { sanitize } from '../../../util/sanitize';
import { coerceString, fromBase64, looseEquals } from '../../../util/string';
import { ensureTrailingSlash, joinUrlParts } from '../../../util/url';
import { incLimitedValue } from '../../../workers/global/limits';
import type {
  AggregatedVulnerabilities,
  AutodiscoverConfig,
  BranchStatusConfig,
  CreatePRConfig,
  EnsureCommentConfig,
  EnsureCommentRemovalConfig,
  EnsureIssueConfig,
  EnsureIssueResult,
  FindPRConfig,
  MergePRConfig,
  PlatformParams,
  PlatformPrOptions,
  PlatformResult,
  Pr,
  ReattemptPlatformAutomergeConfig,
  RepoParams,
  RepoResult,
  UpdatePrConfig,
} from '../types';
import { repoFingerprint } from '../util';
import { normalizeNamePerEcosystem } from '../utils/github-alerts';
import { smartTruncate } from '../utils/pr-body';
import { remoteBranchExists } from './branch';
import { coerceRestPr, githubApi, mapMergeStartegy } from './common';
import {
  enableAutoMergeMutation,
  getIssuesQuery,
  repoInfoQuery,
} from './graphql';
import { GithubIssueCache, GithubIssue as Issue } from './issue';
import { massageMarkdownLinks } from './massage-markdown-links';
import { getPrCache, updatePrCache } from './pr';
import { VulnerabilityAlertSchema } from './schema';
import type {
  BranchProtection,
  CombinedBranchStatus,
  Comment,
  GhAutomergeResponse,
  GhBranchStatus,
  GhPr,
  GhRepo,
  GhRestPr,
  GhRestRepo,
  LocalRepoConfig,
  PlatformConfig,
} from './types';
import { getAppDetails, getUserDetails, getUserEmail } from './user';

export const id = 'github';

let config: LocalRepoConfig;
let platformConfig: PlatformConfig;

const GitHubMaxPrBodyLen = 60000;

export function resetConfigs(): void {
  config = {} as never;
  platformConfig = {
    hostType: 'github',
    endpoint: 'https://api.github.com/',
  };
}

resetConfigs();

function escapeHash(input: string): string {
  return input?.replace(regEx(/#/g), '%23');
}

export function isGHApp(): boolean {
  return !!platformConfig.isGHApp;
}

export async function detectGhe(token: string): Promise<void> {
  platformConfig.isGhe =
    URL.parse(platformConfig.endpoint).host !== 'api.github.com';
  if (platformConfig.isGhe) {
    const gheHeaderKey = 'x-github-enterprise-version';
    const gheQueryRes = await githubApi.headJson('/', { token });
    const gheHeaders = coerceObject(gheQueryRes?.headers);
    const [, gheVersion] =
      Object.entries(gheHeaders).find(
        ([k]) => k.toLowerCase() === gheHeaderKey,
      ) ?? [];
    platformConfig.gheVersion = semver.valid(gheVersion as string) ?? null;
    logger.debug(
      `Detected GitHub Enterprise Server, version: ${platformConfig.gheVersion}`,
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
  /**
   * GHE requires version >=3.10 to support fine-grained access tokens
   * https://docs.github.com/en/enterprise-server@3.10/admin/release-notes#authentication
   */
  if (
    isGithubFineGrainedPersonalAccessToken(token) &&
    platformConfig.isGhe &&
    (!platformConfig.gheVersion ||
      semver.lt(platformConfig.gheVersion, '3.10.0'))
  ) {
    throw new Error(
      'Init: Fine-grained Personal Access Tokens do not support GitHub Enterprise Server API version <3.10 and cannot be used with Renovate.',
    );
  }

  let renovateUsername: string;
  if (username) {
    renovateUsername = username;
  } else if (platformConfig.isGHApp) {
    platformConfig.userDetails ??= await getAppDetails(token);
    renovateUsername = platformConfig.userDetails.username;
  } else {
    platformConfig.userDetails ??= await getUserDetails(
      platformConfig.endpoint,
      token,
    );
    renovateUsername = platformConfig.userDetails.username;
  }
  let discoveredGitAuthor: string | undefined;
  if (!gitAuthor) {
    if (platformConfig.isGHApp) {
      platformConfig.userDetails ??= await getAppDetails(token);
      const ghHostname = platformConfig.isGhe
        ? URL.parse(platformConfig.endpoint).hostname
        : 'github.com';
      discoveredGitAuthor = `${platformConfig.userDetails.name} <${platformConfig.userDetails.id}+${platformConfig.userDetails.username}@users.noreply.${ghHostname}>`;
    } else {
      platformConfig.userDetails ??= await getUserDetails(
        platformConfig.endpoint,
        token,
      );
      platformConfig.userEmail ??= await getUserEmail(
        platformConfig.endpoint,
        token,
      );
      if (platformConfig.userEmail) {
        discoveredGitAuthor = `${platformConfig.userDetails.name} <${platformConfig.userEmail}>`;
      }
    }
  }
  logger.debug({ platformConfig, renovateUsername }, 'Platform config');
  const platformResult: PlatformResult = {
    endpoint: platformConfig.endpoint,
    gitAuthor: gitAuthor ?? discoveredGitAuthor,
    renovateUsername,
    token,
  };
  if (platformResult.endpoint === 'https://api.github.com/') {
    platformResult.hostRules ??= [];
    // allow accessing the central bitrise repo via renovate token
    logger.debug(
      `Converting GITHUB_COM_TOKEN into a central bitrise repo host rule`,
    );
    platformResult.hostRules.push({
      hostType: 'bitrise',
      matchHost: ensureTrailingSlash(
        joinUrlParts(
          platformResult.endpoint,
          'repos',
          'bitrise-io',
          'bitrise-steplib',
          'contents',
        ),
      ),
      token: token.replace(/^x-access-token:/, ''),
    });

    // allow accessing Github hosted package managers
    if (process.env.RENOVATE_X_GITHUB_HOST_RULES) {
      logger.debug('Adding GitHub token as GHCR password');
      platformResult.hostRules.push({
        matchHost: 'ghcr.io',
        hostType: 'docker',
        username: 'USERNAME',
        password: token.replace(/^x-access-token:/, ''),
      });
      logger.debug('Adding GitHub token as npm.pkg.github.com Basic token');
      platformResult.hostRules.push({
        matchHost: 'npm.pkg.github.com',
        hostType: 'npm',
        token: token.replace(/^x-access-token:/, ''),
      });
      const usernamePasswordHostTypes = ['rubygems', 'maven', 'nuget'];
      for (const hostType of usernamePasswordHostTypes) {
        logger.debug(
          `Adding GitHub token as ${hostType}.pkg.github.com password`,
        );
        platformResult.hostRules.push({
          hostType,
          matchHost: `${hostType}.pkg.github.com`,
          username: renovateUsername,
          password: token.replace(/^x-access-token:/, ''),
        });
      }
    }
  }
  return platformResult;
}

async function fetchRepositories(): Promise<GhRestRepo[]> {
  try {
    if (isGHApp()) {
      const res = await githubApi.getJsonUnchecked<{
        repositories: GhRestRepo[];
      }>(`installation/repositories?per_page=100`, {
        paginationField: 'repositories',
        paginate: 'all',
      });
      return res.body.repositories;
    } else {
      const res = await githubApi.getJsonUnchecked<GhRestRepo[]>(
        `user/repos?per_page=100`,
        { paginate: 'all' },
      );
      return res.body;
    }
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, `GitHub getRepos error`);
    throw err;
  }
}

// Get all repositories that the user has access to
export async function getRepos(config?: AutodiscoverConfig): Promise<string[]> {
  logger.debug('Autodiscovering GitHub repositories');
  const nonEmptyRepositories = (await fetchRepositories()).filter(
    is.nonEmptyObject,
  );
  const nonArchivedRepositories = nonEmptyRepositories.filter(
    (repo) => !repo.archived,
  );
  if (nonArchivedRepositories.length < nonEmptyRepositories.length) {
    logger.debug(
      `Filtered out ${
        nonEmptyRepositories.length - nonArchivedRepositories.length
      } archived repositories`,
    );
  }
  if (!config?.topics) {
    return nonArchivedRepositories.map((repo) => repo.full_name);
  }

  logger.debug({ topics: config.topics }, 'Filtering by topics');
  const topicRepositories = nonArchivedRepositories.filter((repo) =>
    repo.topics?.some((topic) => config?.topics?.includes(topic)),
  );

  if (topicRepositories.length < nonArchivedRepositories.length) {
    logger.debug(
      `Filtered out ${
        nonArchivedRepositories.length - topicRepositories.length
      } repositories not matching topic filters`,
    );
  }
  return topicRepositories.map((repo) => repo.full_name);
}

async function getBranchProtection(
  branchName: string,
): Promise<BranchProtection> {
  // istanbul ignore if
  if (config.parentRepo) {
    return {};
  }
  const res = await githubApi.getJsonUnchecked<BranchProtection>(
    `repos/${config.repository}/branches/${escapeHash(branchName)}/protection`,
    { cacheProvider: repoCacheProvider },
  );
  return res.body;
}

export async function getRawFile(
  fileName: string,
  repoName?: string,
  branchOrTag?: string,
): Promise<string | null> {
  const repo = repoName ?? config.repository;

  // only use cache for the same org
  const httpOptions: GithubHttpOptions = {};
  const isSameOrg = repo?.split('/')?.[0] === config.repositoryOwner;
  if (isSameOrg) {
    httpOptions.cacheProvider = repoCacheProvider;
  }

  let url = `repos/${repo}/contents/${fileName}`;
  if (branchOrTag) {
    url += `?ref=` + branchOrTag;
  }
  const res = await githubApi.getJsonUnchecked<{ content: string }>(
    url,
    httpOptions,
  );
  const buf = res.body.content;
  const str = fromBase64(buf);
  return str;
}

export async function getJsonFile(
  fileName: string,
  repoName?: string,
  branchOrTag?: string,
): Promise<any> {
  const raw = await getRawFile(fileName, repoName, branchOrTag);
  return parseJson(raw, fileName);
}

export async function listForks(
  token: string,
  repository: string,
): Promise<GhRestRepo[]> {
  try {
    // Get list of existing repos
    const url = `repos/${repository}/forks?per_page=100`;
    const repos = (
      await githubApi.getJsonUnchecked<GhRestRepo[]>(url, {
        token,
        paginate: true,
        pageLimit: 100,
      })
    ).body;
    logger.debug(`Found ${repos.length} forked repo(s)`);
    return repos;
  } catch (err) {
    if (err.statusCode === 404) {
      logger.debug('Cannot list repo forks - it is likely private');
    } else {
      logger.debug({ err }, 'Unknown error listing repository forks');
    }
    throw new Error(REPOSITORY_CANNOT_FORK);
  }
}

export async function findFork(
  token: string,
  repository: string,
  forkOrg?: string,
): Promise<GhRestRepo | null> {
  const forks = await listForks(token, repository);
  if (forkOrg) {
    logger.debug(`Searching for forked repo in forkOrg (${forkOrg})`);
    const forkedRepo = forks.find((repo) => repo.owner.login === forkOrg);
    if (forkedRepo) {
      logger.debug(`Found repo in forkOrg: ${forkedRepo.full_name}`);
      return forkedRepo;
    }
    logger.debug(`No repo found in forkOrg`);
  }
  logger.debug(`Searching for forked repo in user account`);
  try {
    const { username } = await getUserDetails(platformConfig.endpoint, token);
    const forkedRepo = forks.find((repo) => repo.owner.login === username);
    if (forkedRepo) {
      logger.debug(`Found repo in user account: ${forkedRepo.full_name}`);
      return forkedRepo;
    }
  } catch {
    throw new Error(REPOSITORY_CANNOT_FORK);
  }
  logger.debug(`No repo found in user account`);
  return null;
}

export async function createFork(
  token: string,
  repository: string,
  forkOrg?: string,
): Promise<GhRestRepo> {
  let forkedRepo: GhRestRepo | undefined;
  try {
    forkedRepo = (
      await githubApi.postJson<GhRestRepo>(`repos/${repository}/forks`, {
        token,
        body: {
          organization: forkOrg ?? undefined,
          name: config.parentRepo!.replace('/', '-_-'),
          default_branch_only: true, // no baseBranches support yet
        },
      })
    ).body;
  } catch (err) {
    logger.debug({ err }, 'Error creating fork');
  }
  if (!forkedRepo) {
    throw new Error(REPOSITORY_CANNOT_FORK);
  }
  logger.info({ forkedRepo: forkedRepo.full_name }, 'Created forked repo');
  logger.debug(`Sleeping 30s after creating fork`);
  await setTimeout(30000);
  return forkedRepo;
}

// Initialize GitHub by getting base branch and SHA
export async function initRepo({
  endpoint,
  repository,
  forkCreation,
  forkOrg,
  forkToken,
  renovateUsername,
  cloneSubmodules,
  cloneSubmodulesFilter,
  ignorePrAuthor,
}: RepoParams): Promise<RepoResult> {
  logger.debug(`initRepo("${repository}")`);
  // config is used by the platform api itself, not necessary for the app layer to know
  config = {
    repository,
    cloneSubmodules,
    cloneSubmodulesFilter,
    ignorePrAuthor,
  } as any;
  // istanbul ignore if
  if (endpoint) {
    // Necessary for Renovate Pro - do not remove
    logger.debug(`Overriding default GitHub endpoint with ${endpoint}`);
    platformConfig.endpoint = endpoint;
    githubHttp.setBaseUrl(endpoint);
  }
  const opts = hostRules.find({
    hostType: 'github',
    url: platformConfig.endpoint,
    readOnly: true,
  });
  config.renovateUsername = renovateUsername;
  [config.repositoryOwner, config.repositoryName] = repository.split('/');
  let repo: GhRepo | undefined;
  try {
    let infoQuery = repoInfoQuery;

    // GitHub Enterprise Server <3.3.0 doesn't support autoMergeAllowed and hasIssuesEnabled objects
    // TODO #22198
    if (
      platformConfig.isGhe &&
      // semver not null safe, accepts null and undefined
      semver.satisfies(platformConfig.gheVersion!, '<3.3.0')
    ) {
      infoQuery = infoQuery.replace(/\n\s*autoMergeAllowed\s*\n/, '\n');
      infoQuery = infoQuery.replace(/\n\s*hasIssuesEnabled\s*\n/, '\n');
    }

    // GitHub Enterprise Server <3.9.0 doesn't support hasVulnerabilityAlertsEnabled objects
    if (
      platformConfig.isGhe &&
      // semver not null safe, accepts null and undefined
      semver.satisfies(platformConfig.gheVersion!, '<3.9.0')
    ) {
      infoQuery = infoQuery.replace(
        /\n\s*hasVulnerabilityAlertsEnabled\s*\n/,
        '\n',
      );
    }

    const res = await githubApi.requestGraphql<{
      repository: GhRepo;
    }>(infoQuery, {
      variables: {
        owner: config.repositoryOwner,
        name: config.repositoryName,
        user: renovateUsername,
      },
      readOnly: true,
    });

    if (res?.errors) {
      if (res.errors.find((err) => err.type === 'RATE_LIMITED')) {
        logger.debug({ res }, 'Graph QL rate limit exceeded.');
        throw new Error(PLATFORM_RATE_LIMIT_EXCEEDED);
      }
      logger.debug({ res }, 'Unexpected Graph QL errors');
      throw new Error(PLATFORM_UNKNOWN_ERROR);
    }

    repo = res?.data?.repository;
    // istanbul ignore if
    if (!repo) {
      logger.debug({ res }, 'No repository returned');
      throw new Error(REPOSITORY_NOT_FOUND);
    }
    // istanbul ignore if
    if (!repo.defaultBranchRef?.name) {
      logger.debug(
        { res },
        'No default branch returned - treating repo as empty',
      );
      throw new Error(REPOSITORY_EMPTY);
    }
    if (
      repo.nameWithOwner &&
      repo.nameWithOwner.toUpperCase() !== repository.toUpperCase()
    ) {
      logger.debug(
        { desiredRepo: repository, foundRepo: repo.nameWithOwner },
        'Repository has been renamed',
      );
      throw new Error(REPOSITORY_RENAMED);
    }
    if (repo.isArchived) {
      logger.debug(
        'Repository is archived - throwing error to abort renovation',
      );
      throw new Error(REPOSITORY_ARCHIVED);
    }
    // Use default branch as PR target unless later overridden.
    config.defaultBranch = repo.defaultBranchRef.name;
    // Base branch may be configured but defaultBranch is always fixed
    logger.debug(`${repository} default branch = ${config.defaultBranch}`);
    // GitHub allows administrators to block certain types of merge, so we need to check it
    if (repo.squashMergeAllowed) {
      config.mergeMethod = 'squash';
    } else if (repo.mergeCommitAllowed) {
      config.mergeMethod = 'merge';
    } else if (repo.rebaseMergeAllowed) {
      config.mergeMethod = 'rebase';
    } else {
      // This happens if we don't have Administrator read access, it is not a critical error
      logger.debug('Could not find allowed merge methods for repo');
    }
    config.autoMergeAllowed = repo.autoMergeAllowed;
    config.hasIssuesEnabled = repo.hasIssuesEnabled;
    config.hasVulnerabilityAlertsEnabled = repo.hasVulnerabilityAlertsEnabled;

    const recentIssues = Issue.array()
      .catch([])
      .parse(res?.data?.repository?.issues?.nodes);
    GithubIssueCache.addIssuesToReconcile(recentIssues);
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
    if (err.message === REPOSITORY_FORK_MODE_FORKED) {
      throw err;
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
  config.prList = null;

  if (forkToken) {
    logger.debug('Bot is in fork mode');
    if (repo.isFork) {
      logger.debug(
        `Forked repos cannot be processed when running with a forkToken, so this repo will be skipped`,
      );
      logger.debug(
        `Parent repo for this forked repo is ${repo.parent?.nameWithOwner}`,
      );
      throw new Error(REPOSITORY_FORKED);
    }
    config.forkOrg = forkOrg;
    config.forkToken = forkToken;
    // save parent name then delete
    config.parentRepo = config.repository;
    config.repository = null;
    let forkedRepo = await findFork(forkToken, repository, forkOrg);
    if (forkedRepo) {
      config.repository = forkedRepo.full_name;
      const forkDefaultBranch = forkedRepo.default_branch;
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
          'Fork has different default branch to parent, attempting to create branch',
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
              `Branch ${config.defaultBranch} already exists in the fork`,
            );
          } else {
            logger.warn(
              { err, body: err.response?.body },
              'Could not create parent defaultBranch in fork',
            );
          }
        }
        logger.debug(
          `Setting ${config.defaultBranch} as default branch for ${config.repository}`,
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
      // This is a lovely "hack" by GitHub that lets us force update our fork's default branch
      // with the base commit from the parent repository
      const url = `repos/${config.repository}/git/refs/heads/${config.defaultBranch}`;
      const sha = repo.defaultBranchRef.target.oid;
      try {
        logger.debug(
          `Updating forked repository default sha ${sha} to match upstream`,
        );
        await githubApi.patchJson(url, {
          body: {
            sha,
            force: true,
          },
          token: coerceString(forkToken, opts.token),
        });
      } catch (err) /* istanbul ignore next */ {
        logger.warn(
          { url, sha, err: err.err || err },
          'Error updating fork from upstream - cannot continue',
        );
        if (err instanceof ExternalHostError) {
          throw err;
        }
        throw new ExternalHostError(err);
      }
    } else if (forkCreation) {
      logger.debug('Forked repo is not found - attempting to create it');
      forkedRepo = await createFork(forkToken, repository, forkOrg);
      config.repository = forkedRepo.full_name;
    } else {
      logger.debug('Forked repo is not found and forkCreation is disabled');
      throw new Error(REPOSITORY_FORK_MISSING);
    }
  }

  const parsedEndpoint = URL.parse(platformConfig.endpoint);
  // istanbul ignore else
  if (forkToken) {
    logger.debug('Using forkToken for git init');
    parsedEndpoint.auth = coerceToNull(config.forkToken);
  } else {
    const tokenType = opts.token?.startsWith('x-access-token:')
      ? 'app'
      : 'personal access';
    logger.debug(`Using ${tokenType} token for git init`);
    parsedEndpoint.auth = opts.token ?? null;
  }
  // TODO: null checks (#22198)
  parsedEndpoint.host = parsedEndpoint.host!.replace(
    'api.github.com',
    'github.com',
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

export async function getBranchForceRebase(
  branchName: string,
): Promise<boolean> {
  config.branchForceRebase ??= {};
  if (config.branchForceRebase[branchName] === undefined) {
    try {
      config.branchForceRebase[branchName] = false;
      const branchProtection = await getBranchProtection(branchName);
      logger.debug(`Found branch protection for branch ${branchName}`);
      if (branchProtection?.required_status_checks?.strict) {
        logger.debug(
          `Branch protection: PRs must be up-to-date before merging for ${branchName}`,
        );
        config.branchForceRebase[branchName] = true;
      }
    } catch (err) {
      if (err.statusCode === 404) {
        logger.debug(`No branch protection found for ${branchName}`);
      } else if (
        err.message === PLATFORM_INTEGRATION_UNAUTHORIZED ||
        err.statusCode === 403
      ) {
        logger.once.debug(
          'Branch protection: Do not have permissions to detect branch protection',
        );
      } else {
        throw err;
      }
    }
  }
  return !!config.branchForceRebase[branchName];
}

function cachePr(pr?: GhPr | null): void {
  config.prList ??= [];
  if (pr) {
    updatePrCache(pr);
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
    const { body: ghRestPr } = await githubApi.getJsonUnchecked<GhRestPr>(
      `repos/${config.parentRepo ?? config.repository}/pulls/${prNo}`,
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
  if (desiredState === 'all') {
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
      !config.forkToken && !config.ignorePrAuthor && config.renovateUsername
        ? config.renovateUsername
        : null;
    // TODO: check null `repo` (#22198)
    const prCache = await getPrCache(githubApi, repo!, username);
    config.prList = Object.values(prCache).sort(
      ({ number: a }, { number: b }) => b - a,
    );
  }

  return config.prList;
}

export async function findPr({
  branchName,
  prTitle,
  state = 'all',
  includeOtherAuthors,
}: FindPRConfig): Promise<GhPr | null> {
  logger.debug(`findPr(${branchName}, ${prTitle}, ${state})`);

  if (includeOtherAuthors) {
    const repo = config.parentRepo ?? config.repository;
    const org = repo?.split('/')[0];
    // PR might have been created by anyone, so don't use the cached Renovate PR list
    const { body: prList } = await githubApi.getJsonUnchecked<GhRestPr[]>(
      `repos/${repo}/pulls?head=${org}:${branchName}&state=open`,
      { cacheProvider: repoCacheProvider },
    );

    if (!prList.length) {
      logger.debug(`No PR found for branch ${branchName}`);
      return null;
    }

    return coerceRestPr(prList[0]);
  }

  const prList = await getPrList();
  const pr = prList.find((p) => {
    if (p.sourceBranch !== branchName) {
      return false;
    }

    if (prTitle && prTitle.toUpperCase() !== p.title.toUpperCase()) {
      return false;
    }

    if (!matchesState(p.state, state)) {
      return false;
    }

    if (!config.forkToken && !looseEquals(config.repository, p.sourceRepo)) {
      return false;
    }

    return true;
  });
  if (pr) {
    logger.debug(`Found PR #${pr.number}`);
  }
  return pr ?? null;
}

async function ensureBranchSha(
  branchName: string,
  sha: LongCommitSha,
): Promise<void> {
  const repository = config.repository!;
  try {
    const commitUrl = `/repos/${repository}/git/commits/${sha}`;
    await githubApi.head(commitUrl, { memCache: false });
  } catch (err) {
    logger.error({ err, sha, branchName }, 'Commit not found');
    throw err;
  }

  const refUrl = `/repos/${config.repository}/git/refs/heads/${branchName}`;
  const branchExists = await remoteBranchExists(repository, branchName);

  if (branchExists) {
    try {
      await githubApi.patchJson(refUrl, { body: { sha, force: true } });
      return;
    } catch (err) {
      if (err.err?.response?.statusCode === 422) {
        logger.debug(
          { err },
          'Branch update failed due to reference not existing - will try to create',
        );
      } else {
        logger.warn({ refUrl, err }, 'Error updating branch');
        throw err;
      }
    }
  }

  await githubApi.postJson(`/repos/${repository}/git/refs`, {
    body: { sha, ref: `refs/heads/${branchName}` },
  });
}

// Returns the Pull Request for a branch. Null if not exists.
export async function getBranchPr(branchName: string): Promise<GhPr | null> {
  logger.debug(`getBranchPr(${branchName})`);

  const openPr = await findPr({
    branchName,
    state: 'open',
  });

  if (openPr) {
    return openPr;
  }

  return null;
}

export async function tryReuseAutoclosedPr(
  autoclosedPr: Pr,
): Promise<Pr | null> {
  const { sha, number, sourceBranch: branchName } = autoclosedPr;
  try {
    await ensureBranchSha(branchName, sha!);
    logger.debug(`Recreated autoclosed branch ${branchName} with sha ${sha}`);
  } catch (err) {
    logger.debug(
      { err, branchName, sha, autoclosedPr },
      'Could not recreate autoclosed branch - skipping reopen',
    );
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
      },
    );
    logger.info(
      { branchName, title, number },
      'Successfully reopened autoclosed PR',
    );
    const result = coerceRestPr(ghPr);
    cachePr(result);
    return result;
  } catch {
    logger.debug('Could not reopen autoclosed PR');
    return null;
  }
}

async function getStatus(
  branchName: string,
  useCache = true,
): Promise<CombinedBranchStatus> {
  const branch = escapeHash(branchName);
  const url = `repos/${config.repository}/commits/${branch}/status`;

  const { body: status } =
    await githubApi.getJsonUnchecked<CombinedBranchStatus>(url, {
      memCache: useCache,
      cacheProvider: repoCacheProvider,
    });

  return status;
}

// Returns the combined status for a branch.
export async function getBranchStatus(
  branchName: string,
  internalChecksAsSuccess: boolean,
): Promise<BranchStatus> {
  logger.debug(`getBranchStatus(${branchName})`);
  let commitStatus: CombinedBranchStatus;
  try {
    commitStatus = await getStatus(branchName);
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 404) {
      logger.debug(
        'Received 404 when checking branch status, assuming that branch has been deleted',
      );
      throw new Error(REPOSITORY_CHANGED);
    }
    logger.debug('Unknown error when checking branch status');
    throw err;
  }
  logger.debug(
    { state: commitStatus.state, statuses: commitStatus.statuses },
    'branch status check result',
  );
  if (commitStatus.statuses && !internalChecksAsSuccess) {
    commitStatus.statuses = commitStatus.statuses.filter(
      (status) =>
        status.state !== 'success' || !status.context?.startsWith('renovate/'),
    );
    if (!commitStatus.statuses.length) {
      logger.debug(
        'Successful checks are all internal renovate/ checks, so returning "pending" branch status',
      );
      commitStatus.state = 'pending';
    }
  }
  let checkRuns: { name: string; status: string; conclusion: string }[] = [];
  // API is supported in oldest available GHE version 2.19
  try {
    const checkRunsUrl = `repos/${config.repository}/commits/${escapeHash(
      branchName,
    )}/check-runs?per_page=100`;
    const opts = {
      headers: {
        accept: 'application/vnd.github.antiope-preview+json',
      },
      paginate: true,
      paginationField: 'check_runs',
    };
    const checkRunsRaw = (
      await githubApi.getJsonUnchecked<{
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
      return 'green';
    }
    if (commitStatus.state === 'failure') {
      return 'red';
    }
    return 'yellow';
  }
  if (
    commitStatus.state === 'failure' ||
    checkRuns.some((run) => run.conclusion === 'failure')
  ) {
    return 'red';
  }
  if (
    (commitStatus.state === 'success' || commitStatus.statuses.length === 0) &&
    checkRuns.every((run) =>
      ['skipped', 'neutral', 'success'].includes(run.conclusion),
    )
  ) {
    return 'green';
  }
  return 'yellow';
}

async function getStatusCheck(
  branchName: string,
  useCache = true,
): Promise<GhBranchStatus[]> {
  const branchCommit = git.getBranchCommit(branchName);

  const url = `repos/${config.repository}/commits/${branchCommit}/statuses`;

  return (
    await githubApi.getJsonUnchecked<GhBranchStatus[]>(url, {
      memCache: useCache,
    })
  ).body;
}

type GithubToRenovateStatusMapping = Record<string, BranchStatus>;
const githubToRenovateStatusMapping: GithubToRenovateStatusMapping = {
  success: 'green',
  error: 'red',
  failure: 'red',
  pending: 'yellow',
};

export async function getBranchStatusCheck(
  branchName: string,
  context: string,
): Promise<BranchStatus | null> {
  try {
    const res = await getStatusCheck(branchName);
    for (const check of res) {
      if (check.context === context) {
        return githubToRenovateStatusMapping[check.state] || 'yellow';
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

async function getIssues(): Promise<Issue[]> {
  const result = await githubApi.queryRepoField<unknown>(
    getIssuesQuery,
    'issues',
    {
      variables: {
        owner: config.repositoryOwner,
        name: config.repositoryName,
        ...(!config.ignorePrAuthor && { user: config.renovateUsername }),
      },
      readOnly: true,
    },
  );

  logger.debug(`Retrieved ${result.length} issues`);
  return Issue.array().parse(result);
}

export async function getIssueList(): Promise<Issue[]> {
  // istanbul ignore if
  if (config.hasIssuesEnabled === false) {
    return [];
  }
  let issueList = GithubIssueCache.getIssues();
  if (!issueList) {
    logger.debug('Retrieving issueList');
    issueList = await getIssues();
    GithubIssueCache.setIssues(issueList);
  }
  return issueList;
}

export async function getIssue(number: number): Promise<Issue | null> {
  if (config.hasIssuesEnabled === false) {
    return null;
  }
  try {
    const repo = config.parentRepo ?? config.repository;
    const { body: issue } = await githubApi.getJson(
      `repos/${repo}/issues/${number}`,
      {
        cacheProvider: repoCacheProvider,
      },
      Issue,
    );
    GithubIssueCache.updateIssue(issue);
    return issue;
  } catch (err) {
    logger.debug({ err, number }, 'Error getting issue');
    if (err.response?.statusCode === 410) {
      logger.debug(`Issue #${number} has been deleted`);
      GithubIssueCache.deleteIssue(number);
    }
    return null;
  }
}

export async function findIssue(title: string): Promise<Issue | null> {
  logger.debug(`findIssue(${title})`);
  const [issue] = (await getIssueList()).filter(
    (i) => i.state === 'open' && i.title === title,
  );
  if (!issue) {
    return null;
  }
  logger.debug(`Found issue ${issue.number}`);
  return getIssue(issue.number);
}

async function closeIssue(issueNumber: number): Promise<void> {
  logger.debug(`closeIssue(${issueNumber})`);
  const repo = config.parentRepo ?? config.repository;
  const { body: closedIssue } = await githubApi.patchJson(
    `repos/${repo}/issues/${issueNumber}`,
    { body: { state: 'closed' } },
    Issue,
  );
  GithubIssueCache.updateIssue(closedIssue);
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
      'Cannot ensure issue because issues are disabled in this repository',
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
        logger.debug(`Reusing issue title: "${reuseTitle}"`);
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
          logger.warn({ issueNo: i.number }, 'Closing duplicate issue');
          await closeIssue(i.number);
        }
      }

      const repo = config.parentRepo ?? config.repository;
      const { body: serverIssue } = await githubApi.getJson(
        `repos/${repo}/issues/${issue.number}`,
        { cacheProvider: repoCacheProvider },
        Issue,
      );
      GithubIssueCache.updateIssue(serverIssue);

      if (
        issue.title === title &&
        serverIssue.body === body &&
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
        const repo = config.parentRepo ?? config.repository;
        const { body: updatedIssue } = await githubApi.patchJson(
          `repos/${repo}/issues/${issue.number}`,
          { body: data },
          Issue,
        );
        GithubIssueCache.updateIssue(updatedIssue);
        logger.debug('Issue updated');
        return 'updated';
      }
    }
    const { body: createdIssue } = await githubApi.postJson(
      `repos/${config.parentRepo ?? config.repository}/issues`,
      {
        body: {
          title,
          body,
          labels: labels ?? [],
        },
      },
      Issue,
    );
    logger.info('Issue created');
    // reset issueList so that it will be fetched again as-needed
    GithubIssueCache.updateIssue(createdIssue);
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
    return;
  }
  const issueList = await getIssueList();
  for (const issue of issueList) {
    if (issue.state === 'open' && issue.title === title) {
      await closeIssue(issue.number);
      logger.debug(`Issue closed, issueNo: ${issue.number}`);
    }
  }
}

async function tryAddMilestone(
  issueNo: number,
  milestoneNo: number | undefined,
): Promise<void> {
  if (!milestoneNo) {
    return;
  }

  logger.debug(
    {
      milestone: milestoneNo,
      pr: issueNo,
    },
    'Adding milestone to PR',
  );
  try {
    const repo = config.parentRepo ?? config.repository;
    const { body: updatedIssue } = await githubApi.patchJson(
      `repos/${repo}/issues/${issueNo}`,
      { body: { milestone: milestoneNo } },
      Issue,
    );
    GithubIssueCache.updateIssue(updatedIssue);
  } catch (err) {
    const actualError = err.response?.body || /* istanbul ignore next */ err;
    logger.warn(
      {
        milestone: milestoneNo,
        pr: issueNo,
        err: actualError,
      },
      'Unable to add milestone to PR',
    );
  }
}

export async function addAssignees(
  issueNo: number,
  assignees: string[],
): Promise<void> {
  logger.debug(`Adding assignees '${assignees.join(', ')}' to #${issueNo}`);
  const repository = config.parentRepo ?? config.repository;
  const { body: updatedIssue } = await githubApi.postJson(
    `repos/${repository}/issues/${issueNo}/assignees`,
    { body: { assignees } },
    Issue,
  );
  GithubIssueCache.updateIssue(updatedIssue);
}

export async function addReviewers(
  prNo: number,
  reviewers: string[],
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
      },
    );
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Failed to assign reviewer');
  }
}

export async function addLabels(
  issueNo: number,
  labels: string[] | null | undefined,
): Promise<void> {
  logger.debug(`Adding labels '${labels?.join(', ')}' to #${issueNo}`);
  try {
    const repository = config.parentRepo ?? config.repository;
    if (is.array(labels) && labels.length) {
      await githubApi.postJson(`repos/${repository}/issues/${issueNo}/labels`, {
        body: labels,
      });
    }
  } catch (err) {
    logger.warn(
      { err, issueNo, labels },
      'Error while adding labels. Skipping',
    );
  }
}

export async function deleteLabel(
  issueNo: number,
  label: string,
): Promise<void> {
  logger.debug(`Deleting label ${label} from #${issueNo}`);
  const repository = config.parentRepo ?? config.repository;
  try {
    await githubApi.deleteJson(
      `repos/${repository}/issues/${issueNo}/labels/${label}`,
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
    },
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
    },
  );
}

async function deleteComment(commentId: number): Promise<void> {
  // DELETE /repos/:owner/:repo/issues/comments/:id
  await githubApi.deleteJson(
    `repos/${
      config.parentRepo ?? config.repository
    }/issues/comments/${commentId}`,
  );
}

async function getComments(issueNo: number): Promise<Comment[]> {
  // GET /repos/:owner/:repo/issues/:number/comments
  logger.debug(`Getting comments for #${issueNo}`);
  const repo = config.parentRepo ?? config.repository;
  const url = `repos/${repo}/issues/${issueNo}/comments?per_page=100`;
  try {
    const { body: comments } = await githubApi.getJsonUnchecked<Comment[]>(
      url,
      {
        paginate: true,
        cacheProvider: repoCacheProvider,
      },
    );
    logger.debug(`Found ${comments.length} comments`);
    return comments;
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 404) {
      logger.debug('404 response when retrieving comments');
      throw new ExternalHostError(err, 'github');
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
        'Comment added',
      );
    } else if (commentNeedsUpdating) {
      await editComment(commentId, body);
      logger.debug(
        { repository: config.repository, issueNo: number },
        'Comment updated',
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
  deleteConfig: EnsureCommentRemovalConfig,
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
      logger.debug(`Removing comment from issueNo: ${issueNo}`);
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
  platformPrOptions: PlatformPrOptions | undefined,
): Promise<void> {
  if (!platformPrOptions?.usePlatformAutomerge) {
    return;
  }

  // If GitHub Enterprise Server <3.3.0 it doesn't support automerge
  // TODO #22198
  if (platformConfig.isGhe) {
    // semver not null safe, accepts null and undefined
    if (semver.satisfies(platformConfig.gheVersion!, '<3.3.0')) {
      logger.debug(
        { prNumber },
        'GitHub-native automerge: not supported on this version of GHE. Use 3.3.0 or newer.',
      );
      return;
    }
  }

  if (!config.autoMergeAllowed) {
    logger.debug(
      { prNumber },
      'GitHub-native automerge: not enabled in repo settings',
    );
    return;
  }

  try {
    const mergeMethod = config.mergeMethod?.toUpperCase() || 'MERGE';
    const variables = { pullRequestId: prNodeId, mergeMethod };
    const queryOptions = { variables };

    const res = await githubApi.requestGraphql<GhAutomergeResponse>(
      enableAutoMergeMutation,
      queryOptions,
    );

    if (res?.errors) {
      logger.debug(
        { prNumber, errors: res.errors },
        'GitHub-native automerge: fail',
      );
      return;
    }

    logger.debug(`GitHub-native automerge: success...PrNo: ${prNumber}`);
  } catch (err) /* istanbul ignore next: missing test #22198 */ {
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
  platformPrOptions,
  milestone,
}: CreatePRConfig): Promise<GhPr | null> {
  const body = sanitize(rawBody);
  const base = targetBranch;
  // Include the repository owner to handle forkToken and regular mode
  // TODO: can `repository` be null? (#22198)

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
    options.body.maintainer_can_modify =
      !config.forkOrg &&
      platformPrOptions?.forkModeDisallowMaintainerEdits !== true;
  }
  logger.debug({ title, head, base, draft: draftPR }, 'Creating PR');
  const ghPr = (
    await githubApi.postJson<GhRestPr>(
      `repos/${config.parentRepo ?? config.repository}/pulls`,
      options,
    )
  ).body;
  logger.debug(
    { branch: sourceBranch, pr: ghPr.number, draft: draftPR },
    'PR created',
  );

  const result = coerceRestPr(ghPr);
  const { number, node_id } = result;

  await addLabels(number, labels);
  await tryAddMilestone(number, milestone);
  await tryPrAutomerge(number, node_id, platformPrOptions);

  cachePr(result);
  return result;
}

export async function updatePr({
  number: prNo,
  prTitle: title,
  prBody: rawBody,
  addLabels: labelsToAdd,
  removeLabels,
  state,
  targetBranch,
}: UpdatePrConfig): Promise<void> {
  logger.debug(`updatePr(${prNo}, ${title}, body)`);
  const body = sanitize(rawBody);
  const patchBody: any = { title };
  if (body) {
    patchBody.body = body;
  }
  if (targetBranch) {
    patchBody.base = targetBranch;
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

  // Update PR labels
  try {
    if (labelsToAdd) {
      await addLabels(prNo, labelsToAdd);
    }

    if (removeLabels) {
      for (const label of removeLabels) {
        await deleteLabel(prNo, label);
      }
    }

    const { body: ghPr } = await githubApi.patchJson<GhRestPr>(
      `repos/${config.parentRepo ?? config.repository}/pulls/${prNo}`,
      options,
    );
    const result = coerceRestPr(ghPr);
    cachePr(result);
    logger.debug(`PR updated...prNo: ${prNo}`);
  } catch (err) /* istanbul ignore next */ {
    if (err instanceof ExternalHostError) {
      throw err;
    }
    logger.warn({ err }, 'Error updating PR');
  }
}

export async function reattemptPlatformAutomerge({
  number,
  platformPrOptions,
}: ReattemptPlatformAutomergeConfig): Promise<void> {
  try {
    const result = (await getPr(number))!;
    const { node_id } = result;

    await tryPrAutomerge(number, node_id, platformPrOptions);

    logger.debug(`PR platform automerge re-attempted...prNo: ${number}`);
  } catch (err) {
    logger.warn({ err }, 'Error re-attempting PR platform automerge');
  }
}

export async function mergePr({
  branchName,
  id: prNo,
  strategy,
}: MergePRConfig): Promise<boolean> {
  logger.debug(`mergePr(${prNo}, ${branchName})`);
  const url = `repos/${
    config.parentRepo ?? config.repository
  }/pulls/${prNo}/merge`;
  const options: GithubHttpOptions = {
    body: {},
  };
  // istanbul ignore if
  if (config.forkToken) {
    options.token = config.forkToken;
  }
  let automerged = false;
  let automergeResult: HttpResponse<unknown>;
  const mergeStrategy = mapMergeStartegy(strategy) ?? config.mergeMethod;

  if (mergeStrategy) {
    // This path is taken if we have auto-detected the allowed merge types from the repo or
    // automergeStrategy is configured by user
    options.body.merge_method = mergeStrategy;
    try {
      logger.debug({ options, url }, `mergePr`);
      automergeResult = await githubApi.putJson(url, options);
      automerged = true;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 405) {
        const body = err.response?.body;
        if (
          is.nonEmptyString(body?.message) &&
          regEx(/^Required status check ".+" is expected\.$/).test(body.message)
        ) {
          logger.debug(
            { response: body },
            `GitHub blocking PR merge -- Missing required status check(s)`,
          );
          return false;
        }
        if (
          is.nonEmptyString(body?.message) &&
          (body.message.includes('approving review') ||
            body.message.includes('code owner review'))
        ) {
          logger.debug(
            { response: body },
            `GitHub blocking PR merge -- Needs approving review(s)`,
          );
          return false;
        }
        logger.debug(
          { response: body },
          'GitHub blocking PR merge -- will keep trying',
        );
      } else {
        logger.warn(
          { mergeMethod: config.mergeMethod, err },
          'Failed to merge PR',
        );
        return false;
      }
    }
  }
  if (!automerged) {
    // We need to guess the merge method and try squash -> merge -> rebase
    options.body.merge_method = 'squash';
    try {
      logger.debug({ options, url }, `mergePr`);
      automergeResult = await githubApi.putJson(url, options);
    } catch (err1) {
      logger.debug({ err: err1 }, `Failed to squash merge PR`);
      try {
        options.body.merge_method = 'merge';
        logger.debug({ options, url }, `mergePr`);
        automergeResult = await githubApi.putJson(url, options);
      } catch (err2) {
        logger.debug({ err: err2 }, `Failed to merge commit PR`);
        try {
          options.body.merge_method = 'rebase';
          logger.debug({ options, url }, `mergePr`);
          automergeResult = await githubApi.putJson(url, options);
        } catch (err3) {
          logger.debug({ err: err3 }, `Failed to rebase merge PR`);
          logger.info({ pr: prNo }, 'All merge attempts failed');
          return false;
        }
      }
    }
  }
  logger.debug(
    { automergeResult: automergeResult!.body, pr: prNo },
    'PR merged',
  );
  const cachedPr = config.prList?.find(({ number }) => number === prNo);
  if (cachedPr) {
    cachePr({ ...cachedPr, state: 'merged' });
  }
  return true;
}

export function massageMarkdown(input: string): string {
  if (platformConfig.isGhe) {
    return smartTruncate(input, maxBodyLength());
  }
  const massagedInput = massageMarkdownLinks(input)
    // to be safe, replace all github.com links with redirect.github.com
    .replace(
      regEx(/href="https?:\/\/github.com\//g),
      'href="https://redirect.github.com/',
    )
    .replace(
      regEx(/]\(https:\/\/github\.com\//g),
      '](https://redirect.github.com/',
    )
    .replace(
      regEx(/]: https:\/\/github\.com\//g),
      ']: https://redirect.github.com/',
    )
    .replace('> ℹ **Note**\n> \n', '> [!NOTE]\n')
    .replace('> ⚠ **Warning**\n> \n', '> [!WARNING]\n')
    .replace('> ⚠️ **Warning**\n> \n', '> [!WARNING]\n')
    .replace('> ❗ **Important**\n> \n', '> [!IMPORTANT]\n');
  return smartTruncate(massagedInput, maxBodyLength());
}

export function maxBodyLength(): number {
  return GitHubMaxPrBodyLen;
}

export async function getVulnerabilityAlerts(): Promise<VulnerabilityAlert[]> {
  if (config.hasVulnerabilityAlertsEnabled === false) {
    logger.debug('No vulnerability alerts enabled for repo');
    return [];
  }
  let vulnerabilityAlerts: VulnerabilityAlert[] | undefined;
  try {
    vulnerabilityAlerts = (
      await githubApi.getJson(
        `/repos/${config.repositoryOwner}/${config.repositoryName}/dependabot/alerts?state=open&direction=asc&per_page=100`,
        {
          paginate: false,
          headers: { accept: 'application/vnd.github+json' },
          cacheProvider: repoCacheProvider,
        },
        VulnerabilityAlertSchema,
      )
    ).body;
  } catch (err) {
    logger.debug({ err }, 'Error retrieving vulnerability alerts');
    logger.warn(
      {
        url: 'https://docs.renovatebot.com/configuration-options/#vulnerabilityalerts',
      },
      'Cannot access vulnerability alerts. Please ensure permissions have been granted.',
    );
  }
  try {
    if (vulnerabilityAlerts?.length) {
      const shortAlerts: AggregatedVulnerabilities = {};
      logger.trace(
        { alerts: vulnerabilityAlerts },
        'GitHub vulnerability details',
      );
      for (const alert of vulnerabilityAlerts) {
        if (alert.security_vulnerability === null) {
          // As described in the documentation, there are cases in which
          // GitHub API responds with `"securityVulnerability": null`.
          // But it's may be faulty, so skip processing it here.
          continue;
        }
        const {
          package: { name, ecosystem },
          vulnerable_version_range: vulnerableVersionRange,
          first_patched_version: firstPatchedVersion,
        } = alert.security_vulnerability;
        const patch = firstPatchedVersion?.identifier;

        const normalizedName = normalizeNamePerEcosystem({ name, ecosystem });
        alert.security_vulnerability.package.name = normalizedName;
        const key = `${ecosystem.toLowerCase()}/${normalizedName}`;
        const range = vulnerableVersionRange;
        const elem = shortAlerts[key] || {};
        elem[range] = coerceToNull(patch);
        shortAlerts[key] = elem;
      }
      logger.debug({ alerts: shortAlerts }, 'GitHub vulnerability details');
    } else {
      logger.debug('No vulnerability alerts found');
    }
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, 'Error processing vulnerabity alerts');
  }
  return vulnerabilityAlerts ?? [];
}

async function pushFiles(
  { branchName, message }: CommitFilesConfig,
  { parentCommitSha, commitSha }: CommitResult,
): Promise<LongCommitSha | null> {
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
      { body: { tree: treeItems } },
    );
    const treeSha = treeRes.body.sha;

    // Now we recreate the commit using the tree we recreated the step before
    const commitRes = await githubApi.postJson<{ sha: string }>(
      `/repos/${config.repository}/git/commits`,
      { body: { message, tree: treeSha, parents: [parentCommitSha] } },
    );
    incLimitedValue('Commits');
    const remoteCommitSha = commitRes.body.sha as LongCommitSha;
    await ensureBranchSha(branchName, remoteCommitSha);
    return remoteCommitSha;
  } catch (err) {
    logger.debug({ branchName, err }, 'Platform-native commit: unknown error');
    return null;
  }
}

export async function commitFiles(
  config: CommitFilesConfig,
): Promise<LongCommitSha | null> {
  const commitResult = await git.prepareCommit(config); // Commit locally and don't push
  const { branchName, files } = config;
  if (!commitResult) {
    logger.debug(
      { branchName, files: files.map(({ path }) => path) },
      `Platform-native commit: unable to prepare for commit`,
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
  const commitSha = await git.fetchBranch(branchName);
  return commitSha;
}
