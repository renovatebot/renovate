import URL from 'url';
import is from '@sindresorhus/is';
import delay from 'delay';
import { configFileNames } from '../../config/app-strings';
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
} from '../../constants/error-messages';
import { PLATFORM_TYPE_GITHUB } from '../../constants/platforms';
import {
  PR_STATE_ALL,
  PR_STATE_CLOSED,
  PR_STATE_OPEN,
} from '../../constants/pull-requests';
import { logger } from '../../logger';
import { BranchStatus } from '../../types';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as git from '../../util/git';
import * as hostRules from '../../util/host-rules';
import * as githubHttp from '../../util/http/github';
import { sanitize } from '../../util/sanitize';
import { ensureTrailingSlash } from '../../util/url';
import {
  BranchStatusConfig,
  CreatePRConfig,
  EnsureCommentConfig,
  EnsureCommentRemovalConfig,
  EnsureIssueConfig,
  EnsureIssueResult,
  FindPRConfig,
  Issue,
  PlatformResult,
  Pr,
  RepoParams,
  RepoResult,
  VulnerabilityAlert,
} from '../common';
import { smartTruncate } from '../utils/pr-body';
import {
  BranchProtection,
  CombinedBranchStatus,
  Comment,
  GhBranchStatus,
  GhPr,
  GhRepo,
  LocalRepoConfig,
  PrList,
} from './types';
import { UserDetails, getUserDetails, getUserEmail } from './user';

const githubApi = new githubHttp.GithubHttp();

const defaultConfigFile = configFileNames[0];

let config: LocalRepoConfig = {} as any;

const defaults = {
  hostType: PLATFORM_TYPE_GITHUB,
  endpoint: 'https://api.github.com/',
};

const escapeHash = (input: string): string =>
  input ? input.replace(/#/g, '%23') : input;

export async function initPlatform({
  endpoint,
  token,
  username,
  gitAuthor,
}: {
  endpoint: string;
  token: string;
  username?: string;
  gitAuthor?: string;
}): Promise<PlatformResult> {
  if (!token) {
    throw new Error('Init: You must configure a GitHub personal access token');
  }

  if (endpoint) {
    defaults.endpoint = ensureTrailingSlash(endpoint);
    githubHttp.setBaseUrl(defaults.endpoint);
  } else {
    logger.debug('Using default github endpoint: ' + defaults.endpoint);
  }
  let userDetails: UserDetails;
  let renovateUsername: string;
  if (username) {
    renovateUsername = username;
  } else {
    userDetails = await getUserDetails(defaults.endpoint, token);
    renovateUsername = userDetails.username;
  }
  let discoveredGitAuthor: string;
  if (!gitAuthor) {
    userDetails = await getUserDetails(defaults.endpoint, token);
    const userEmail = await getUserEmail(defaults.endpoint, token);
    if (userEmail) {
      discoveredGitAuthor = `${userDetails.name} <${userEmail}>`;
    }
  }
  logger.debug('Authenticated as GitHub user: ' + renovateUsername);
  const platformConfig: PlatformResult = {
    endpoint: defaults.endpoint,
    gitAuthor: gitAuthor || discoveredGitAuthor,
    renovateUsername,
  };
  return platformConfig;
}

// Get all repositories that the user has access to
export async function getRepos(): Promise<string[]> {
  logger.debug('Autodiscovering GitHub repositories');
  try {
    const res = await githubApi.getJson<{ full_name: string }[]>(
      'user/repos?per_page=100',
      { paginate: true }
    );
    return res.body.map((repo) => repo.full_name);
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

// Initialize GitHub by getting base branch and SHA
export async function initRepo({
  endpoint,
  repository,
  forkMode,
  forkToken,
  localDir,
  includeForks,
  renovateUsername,
  optimizeForDisabled,
}: RepoParams): Promise<RepoResult> {
  logger.debug(`initRepo("${repository}")`);
  // config is used by the platform api itself, not necessary for the app layer to know
  config = { localDir, repository } as any;
  // istanbul ignore if
  if (endpoint) {
    // Necessary for Renovate Pro - do not remove
    logger.debug({ endpoint }, 'Overriding default GitHub endpoint');
    defaults.endpoint = endpoint;
    githubHttp.setBaseUrl(endpoint);
  }
  const opts = hostRules.find({
    hostType: PLATFORM_TYPE_GITHUB,
    url: defaults.endpoint,
  });
  config.isGhe = URL.parse(defaults.endpoint).host !== 'api.github.com';
  config.renovateUsername = renovateUsername;
  [config.repositoryOwner, config.repositoryName] = repository.split('/');
  let repo: GhRepo;
  try {
    repo = await githubApi.queryRepo<GhRepo>(
      `{
      repository(owner: "${config.repositoryOwner}", name: "${config.repositoryName}") {
        isFork
        isArchived
        nameWithOwner
        mergeCommitAllowed
        rebaseMergeAllowed
        squashMergeAllowed
        defaultBranchRef {
          name
          target {
            oid
          }
        }
      }
    }`
    );
    // istanbul ignore if
    if (!repo) {
      throw new Error(REPOSITORY_NOT_FOUND);
    }
    // istanbul ignore if
    if (!repo.defaultBranchRef?.name) {
      throw new Error(REPOSITORY_EMPTY);
    }
    // istanbul ignore if
    if (repo.isFork && !includeForks) {
      try {
        const renovateConfig = JSON.parse(
          Buffer.from(
            (
              await githubApi.getJson<{ content: string }>(
                `repos/${config.repository}/contents/${defaultConfigFile}`
              )
            ).body.content,
            'base64'
          ).toString()
        );
        if (!renovateConfig.includeForks) {
          throw new Error();
        }
      } catch (err) {
        throw new Error(REPOSITORY_FORKED);
      }
    }
    if (repo.nameWithOwner && repo.nameWithOwner !== repository) {
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
    if (optimizeForDisabled) {
      let renovateConfig;
      try {
        renovateConfig = JSON.parse(
          Buffer.from(
            (
              await githubApi.getJson<{ content: string }>(
                `repos/${config.repository}/contents/${defaultConfigFile}`
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
    // Use default branch as PR target unless later overridden.
    config.defaultBranch = repo.defaultBranchRef.name;
    config.defaultBranchSha = repo.defaultBranchRef.target.oid;
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
  } catch (err) /* istanbul ignore next */ {
    logger.debug('Caught initRepo error');
    if (
      err.message === REPOSITORY_ARCHIVED ||
      err.message === REPOSITORY_RENAMED
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
  config.openPrList = null;
  config.closedPrList = null;

  config.forkMode = !!forkMode;
  if (forkMode) {
    logger.debug('Bot is in forkMode');
    config.forkToken = forkToken;
    // save parent name then delete
    config.parentRepo = config.repository;
    config.repository = null;
    // Get list of existing repos
    const existingRepos = (
      await githubApi.getJson<{ full_name: string }[]>(
        'user/repos?per_page=100',
        {
          token: forkToken || opts.token,
          paginate: true,
        }
      )
    ).body.map((r) => r.full_name);
    try {
      config.repository = (
        await githubApi.postJson<{ full_name: string }>(
          `repos/${repository}/forks`,
          {
            token: forkToken || opts.token,
          }
        )
      ).body.full_name;
    } catch (err) /* istanbul ignore next */ {
      logger.debug({ err }, 'Error forking repository');
      throw new Error(REPOSITORY_CANNOT_FORK);
    }
    if (existingRepos.includes(config.repository)) {
      logger.debug(
        { repository_fork: config.repository },
        'Found existing fork'
      );
      // Need to update base branch
      logger.debug(
        {
          defaultBranch: config.defaultBranch,
          defaultBranchSha: config.defaultBranchSha,
        },
        'Setting defaultBranch ref in fork'
      );
      // This is a lovely "hack" by GitHub that lets us force update our fork's master
      // with the base commit from the parent repository
      try {
        await githubApi.patchJson(
          `repos/${config.repository}/git/refs/heads/${config.defaultBranch}`,
          {
            body: {
              sha: config.defaultBranchSha,
              force: true,
            },
            token: forkToken || opts.token,
          }
        );
      } catch (err) /* istanbul ignore next */ {
        logger.debug(
          'Error updating fork reference - will try deleting fork to try again next time'
        );
        try {
          await githubApi.deleteJson(`repos/${config.repository}`);
          logger.info('Fork deleted');
        } catch (deleteErr) {
          logger.warn({ err: deleteErr }, 'Could not delete fork');
        }
        if (err instanceof ExternalHostError) {
          throw err;
        }
        throw new ExternalHostError(err);
      }
    } else {
      logger.debug({ repository_fork: config.repository }, 'Created fork');
      // Wait an arbitrary 30s to hopefully give GitHub enough time for forking to complete
      await delay(30000);
    }
  }

  const parsedEndpoint = URL.parse(defaults.endpoint);
  // istanbul ignore else
  if (forkMode) {
    logger.debug('Using forkToken for git init');
    parsedEndpoint.auth = config.forkToken;
  } else if (global.appMode) {
    logger.debug('Using app token for git init');
    parsedEndpoint.auth = `x-access-token:${opts.token}`;
  } else {
    logger.debug('Using personal access token for git init');
    parsedEndpoint.auth = opts.token;
  }
  parsedEndpoint.host = parsedEndpoint.host.replace(
    'api.github.com',
    'github.com'
  );
  parsedEndpoint.pathname = config.repository + '.git';
  const url = URL.format(parsedEndpoint);
  await git.initRepo({
    ...config,
    url,
    gitAuthorName: global.gitAuthor?.name,
    gitAuthorEmail: global.gitAuthor?.email,
  });
  const repoConfig: RepoResult = {
    defaultBranch: config.defaultBranch,
    defaultBranchSha: config.defaultBranchSha,
    isFork: repo.isFork === true,
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
      } else if (err.statusCode === 403) {
        logger.debug(
          'Branch protection: Do not have permissions to detect branch protection'
        );
      } else {
        throw err;
      }
    }
  }
  return config.repoForceRebase;
}

// istanbul ignore next
export async function setBaseBranch(branchName: string): Promise<string> {
  const baseBranchSha = await git.setBranch(branchName);
  return baseBranchSha;
}

// Branch

// istanbul ignore next
export function deleteBranch(
  branchName: string,
  closePr?: boolean
): Promise<void> {
  return git.deleteBranch(branchName);
}

async function getClosedPrs(): Promise<PrList> {
  if (!config.closedPrList) {
    config.closedPrList = {};
    let query;
    try {
      // prettier-ignore
      query = `
      query {
        repository(owner: "${config.repositoryOwner}", name: "${config.repositoryName}") {
          pullRequests(states: [CLOSED, MERGED], first: 100, orderBy: {field: UPDATED_AT, direction: DESC}) {
            nodes {
              number
              state
              headRefName
              title
              comments(last: 100) {
                nodes {
                  databaseId
                  body
                }
              }
            }
          }
        }
      }
      `;
      const nodes = await githubApi.queryRepoField<any>(query, 'pullRequests', {
        paginate: false,
      });
      const prNumbers: number[] = [];
      // istanbul ignore if
      if (!nodes?.length) {
        logger.debug({ query }, 'No graphql data, returning empty list');
        return {};
      }
      for (const pr of nodes) {
        // https://developer.github.com/v4/object/pullrequest/
        pr.displayNumber = `Pull Request #${pr.number}`;
        pr.state = pr.state.toLowerCase();
        pr.branchName = pr.headRefName;
        delete pr.headRefName;
        pr.comments = pr.comments.nodes.map(
          (comment: { databaseId: number; body: string }) => ({
            id: comment.databaseId,
            body: comment.body,
          })
        );
        pr.body = 'dummy body'; // just in case
        config.closedPrList[pr.number] = pr;
        prNumbers.push(pr.number);
      }
      prNumbers.sort();
      logger.debug({ prNumbers }, 'Retrieved closed PR list with graphql');
    } catch (err) /* istanbul ignore next */ {
      logger.warn({ query, err }, 'getClosedPrs error');
    }
  }
  return config.closedPrList;
}

async function getOpenPrs(): Promise<PrList> {
  // istanbul ignore if
  if (config.isGhe) {
    logger.debug(
      'Skipping unsupported graphql PullRequests.mergeStateStatus query on GHE'
    );
    return {};
  }
  if (!config.openPrList) {
    config.openPrList = {};
    let query;
    try {
      // prettier-ignore
      query = `
      query {
        repository(owner: "${config.repositoryOwner}", name: "${config.repositoryName}") {
          pullRequests(states: [OPEN], first: 100, orderBy: {field: UPDATED_AT, direction: DESC}) {
            nodes {
              number
              headRefName
              baseRefName
              title
              mergeable
              mergeStateStatus
              labels(last: 100) {
                nodes {
                  name
                }
              }
              assignees {
                totalCount
              }
              reviewRequests {
                totalCount
              }
              commits(first: 2) {
                nodes {
                  commit {
                    author {
                      email
                    }
                    committer {
                      email
                    }
                    parents(last: 1) {
                      edges {
                        node {
                          abbreviatedOid
                          oid
                        }
                      }
                    }
                  }
                }
              }
              body
              reviews(first: 1, states:[CHANGES_REQUESTED]){
                nodes{
                  state
                }
              }
            }
          }
        }
      }
      `;
      const nodes = await githubApi.queryRepoField<any>(query, 'pullRequests', {
        paginate: false,
        acceptHeader: 'application/vnd.github.merge-info-preview+json',
      });
      const prNumbers: number[] = [];
      // istanbul ignore if
      if (!nodes?.length) {
        logger.debug({ query }, 'No graphql res.data');
        return {};
      }
      for (const pr of nodes) {
        // https://developer.github.com/v4/object/pullrequest/
        pr.displayNumber = `Pull Request #${pr.number}`;
        pr.state = PR_STATE_OPEN;
        pr.branchName = pr.headRefName;
        delete pr.headRefName;
        pr.targetBranch = pr.baseRefName;
        delete pr.baseRefName;
        // https://developer.github.com/v4/enum/mergeablestate
        const canMergeStates = ['BEHIND', 'CLEAN'];
        const hasNegativeReview = pr.reviews?.nodes?.length > 0;
        // istanbul ignore if
        if (hasNegativeReview) {
          pr.canMerge = false;
          pr.canMergeReason = `hasNegativeReview`;
        } else if (!canMergeStates.includes(pr.mergeStateStatus)) {
          pr.canMerge = false;
          pr.canMergeReason = `mergeStateStatus = ${pr.mergeStateStatus}`;
        } else {
          pr.canMerge = true;
        }
        // https://developer.github.com/v4/enum/mergestatestatus
        if (pr.mergeStateStatus === 'DIRTY') {
          pr.isConflicted = true;
        } else {
          pr.isConflicted = false;
        }
        if (pr.labels) {
          pr.labels = pr.labels.nodes.map(
            (label: { name: string }) => label.name
          );
        }
        pr.hasAssignees = !!(pr.assignees?.totalCount > 0);
        delete pr.assignees;
        pr.hasReviewers = !!(pr.reviewRequests?.totalCount > 0);
        delete pr.reviewRequests;
        delete pr.mergeable;
        delete pr.mergeStateStatus;
        delete pr.commits;
        config.openPrList[pr.number] = pr;
        prNumbers.push(pr.number);
      }
      prNumbers.sort();
      logger.trace({ prNumbers }, 'Retrieved open PR list with graphql');
    } catch (err) /* istanbul ignore next */ {
      logger.warn({ query, err }, 'getOpenPrs error');
    }
  }
  return config.openPrList;
}

// Gets details for a PR
export async function getPr(prNo: number): Promise<Pr | null> {
  if (!prNo) {
    return null;
  }
  const openPrs = await getOpenPrs();
  const openPr = openPrs[prNo];
  if (openPr) {
    logger.debug('Returning from graphql open PR list');
    return openPr;
  }
  const closedPrs = await getClosedPrs();
  const closedPr = closedPrs[prNo];
  if (closedPr) {
    logger.debug('Returning from graphql closed PR list');
    return closedPr;
  }
  logger.debug(
    { prNo },
    'PR not found in open or closed PRs list - trying to fetch it directly'
  );
  const pr = (
    await githubApi.getJson<any>(
      `repos/${config.parentRepo || config.repository}/pulls/${prNo}`
    )
  ).body;
  if (!pr) {
    return null;
  }
  // Harmonise PR values
  pr.displayNumber = `Pull Request #${pr.number}`;
  if (pr.state === PR_STATE_OPEN) {
    pr.branchName = pr.head ? pr.head.ref : undefined;
    pr.sha = pr.head ? pr.head.sha : undefined;
    if (pr.mergeable === true) {
      pr.canMerge = true;
    } else {
      pr.canMerge = false;
      pr.canMergeReason = `mergeable = ${pr.mergeable}`;
    }
    if (pr.mergeable_state === 'dirty') {
      logger.debug({ prNo }, 'PR state is dirty so unmergeable');
      pr.isConflicted = true;
    }
  }
  return pr;
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

export async function getPrList(): Promise<Pr[]> {
  logger.trace('getPrList()');
  if (!config.prList) {
    logger.debug('Retrieving PR list');
    let res;
    try {
      res = await githubApi.getJson<{
        number: number;
        head: { ref: string; sha: string; repo: { full_name: string } };
        title: string;
        state: string;
        merged_at: string;
        created_at: string;
        closed_at: string;
      }>(
        `repos/${
          config.parentRepo || config.repository
        }/pulls?per_page=100&state=all`,
        { paginate: true }
      );
    } catch (err) /* istanbul ignore next */ {
      logger.debug({ err }, 'getPrList err');
      throw new ExternalHostError(err, PLATFORM_TYPE_GITHUB);
    }
    config.prList = res.body.map((pr) => ({
      number: pr.number,
      branchName: pr.head.ref,
      sha: pr.head.sha,
      title: pr.title,
      state:
        pr.state === PR_STATE_CLOSED && pr.merged_at?.length
          ? /* istanbul ignore next */ 'merged'
          : pr.state,
      createdAt: pr.created_at,
      closed_at: pr.closed_at,
      sourceRepo: pr.head?.repo?.full_name,
    }));
    logger.debug(`Retrieved ${config.prList.length} Pull Requests`);
  }
  return config.prList;
}

export async function findPr({
  branchName,
  prTitle,
  state = PR_STATE_ALL,
}: FindPRConfig): Promise<Pr | null> {
  logger.debug(`findPr(${branchName}, ${prTitle}, ${state})`);
  const prList = await getPrList();
  const pr = prList.find(
    (p) =>
      p.branchName === branchName &&
      (!prTitle || p.title === prTitle) &&
      matchesState(p.state, state) &&
      (config.forkMode || config.repository === p.sourceRepo) // #5188
  );
  if (pr) {
    logger.debug(`Found PR #${pr.number}`);
  }
  return pr;
}

// Returns the Pull Request for a branch. Null if not exists.
export async function getBranchPr(branchName: string): Promise<Pr | null> {
  logger.debug(`getBranchPr(${branchName})`);
  const existingPr = await findPr({
    branchName,
    state: PR_STATE_OPEN,
  });
  return existingPr ? getPr(existingPr.number) : null;
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
  branchName: string,
  requiredStatusChecks: any
): Promise<BranchStatus> {
  logger.debug(`getBranchStatus(${branchName})`);
  if (!requiredStatusChecks) {
    // null means disable status checks, so it always succeeds
    logger.debug('Status checks disabled = returning "success"');
    return BranchStatus.green;
  }
  if (requiredStatusChecks.length) {
    // This is Unsupported
    logger.warn({ requiredStatusChecks }, `Unsupported requiredStatusChecks`);
    return BranchStatus.red;
  }
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
  if (!config.isGhe) {
    try {
      const checkRunsUrl = `repos/${config.repository}/commits/${escapeHash(
        branchName
      )}/check-runs`;
      const opts = {
        headers: {
          accept: 'application/vnd.github.antiope-preview+json',
        },
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
  const branchCommit = await git.getBranchCommit(branchName);

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
  try {
    const branchCommit = await git.getBranchCommit(branchName);
    const url = `repos/${config.repository}/statuses/${branchCommit}`;
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
    logger.debug({ err }, 'Caught error setting branch status - aborting');
    throw new Error(REPOSITORY_CHANGED);
  }
}

// Issue

/* istanbul ignore next */
async function getIssues(): Promise<Issue[]> {
  // prettier-ignore
  const query = `
    query {
      repository(owner: "${config.repositoryOwner}", name: "${config.repositoryName}") {
        issues(orderBy: {field: UPDATED_AT, direction: DESC}, filterBy: {createdBy: "${config.renovateUsername}"}) {
          pageInfo {
            endCursor
            hasNextPage
          }
          nodes {
            number
            state
            title
            body
          }
        }
      }
    }
  `;

  const result = await githubApi.queryRepoField<Issue>(query, 'issues');

  logger.debug(`Retrieved ${result.length} issues`);
  return result.map((issue) => ({
    ...issue,
    state: issue.state.toLowerCase(),
  }));
}

export async function getIssueList(): Promise<Issue[]> {
  if (!config.issueList) {
    logger.debug('Retrieving issueList');
    config.issueList = await getIssues();
  }
  return config.issueList;
}

export async function findIssue(title: string): Promise<Issue | null> {
  logger.debug(`findIssue(${title})`);
  const [issue] = (await getIssueList()).filter(
    (i) => i.state === 'open' && i.title === title
  );
  if (!issue) {
    return null;
  }
  logger.debug('Found issue ' + issue.number);
  const issueBody = (
    await githubApi.getJson<{ body: string }>(
      `repos/${config.parentRepo || config.repository}/issues/${issue.number}`
    )
  ).body.body;
  return {
    number: issue.number,
    body: issueBody,
  };
}

async function closeIssue(issueNumber: number): Promise<void> {
  logger.debug(`closeIssue(${issueNumber})`);
  await githubApi.patchJson(
    `repos/${config.parentRepo || config.repository}/issues/${issueNumber}`,
    {
      body: { state: 'closed' },
    }
  );
}

export async function ensureIssue({
  title,
  reuseTitle,
  body: rawBody,
  once = false,
  shouldReOpen = true,
}: EnsureIssueConfig): Promise<EnsureIssueResult | null> {
  logger.debug(`ensureIssue(${title})`);
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
          logger.warn('Closing duplicate issue ' + i.number);
          await closeIssue(i.number);
        }
      }
      const issueBody = (
        await githubApi.getJson<{ body: string }>(
          `repos/${config.parentRepo || config.repository}/issues/${
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
        await githubApi.patchJson(
          `repos/${config.parentRepo || config.repository}/issues/${
            issue.number
          }`,
          {
            body: { body, state: 'open', title },
          }
        );
        logger.debug('Issue updated');
        return 'updated';
      }
    }
    await githubApi.postJson(
      `repos/${config.parentRepo || config.repository}/issues`,
      {
        body: {
          title,
          body,
        },
      }
    );
    logger.info('Issue created');
    // reset issueList so that it will be fetched again as-needed
    delete config.issueList;
    return 'created';
  } catch (err) /* istanbul ignore next */ {
    if (err.body?.message?.startsWith('Issues are disabled for this repo')) {
      logger.debug(
        `Issues are disabled, so could not create issue: ${err.message}`
      );
    } else {
      logger.warn({ err }, 'Could not ensure issue');
    }
  }
  return null;
}

export async function ensureIssueClosing(title: string): Promise<void> {
  logger.debug(`ensureIssueClosing(${title})`);
  const issueList = await getIssueList();
  for (const issue of issueList) {
    if (issue.state === 'open' && issue.title === title) {
      await closeIssue(issue.number);
      logger.debug({ number: issue.number }, 'Issue closed');
    }
  }
}

export async function addAssignees(
  issueNo: number,
  assignees: string[]
): Promise<void> {
  logger.debug(`Adding assignees ${assignees} to #${issueNo}`);
  const repository = config.parentRepo || config.repository;
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
  logger.debug(`Adding reviewers ${reviewers} to #${prNo}`);

  const userReviewers = reviewers.filter((e) => !e.startsWith('team:'));
  const teamReviewers = reviewers
    .filter((e) => e.startsWith('team:'))
    .map((e) => e.replace(/^team:/, ''));
  try {
    await githubApi.postJson(
      `repos/${
        config.parentRepo || config.repository
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
  labels: string[] | null
): Promise<void> {
  logger.debug(`Adding labels ${labels} to #${issueNo}`);
  const repository = config.parentRepo || config.repository;
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
  const repository = config.parentRepo || config.repository;
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
      config.parentRepo || config.repository
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
      config.parentRepo || config.repository
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
      config.parentRepo || config.repository
    }/issues/comments/${commentId}`
  );
}

async function getComments(issueNo: number): Promise<Comment[]> {
  const pr = (await getClosedPrs())[issueNo];
  if (pr) {
    logger.debug('Returning closed PR list comments');
    return pr.comments;
  }
  // GET /repos/:owner/:repo/issues/:number/comments
  logger.debug(`Getting comments for #${issueNo}`);
  const url = `repos/${
    config.parentRepo || config.repository
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
      logger.debug('404 respose when retrieving comments');
      throw new ExternalHostError(err, PLATFORM_TYPE_GITHUB);
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

export async function ensureCommentRemoval({
  number: issueNo,
  topic,
  content,
}: EnsureCommentRemovalConfig): Promise<void> {
  logger.trace(
    `Ensuring comment "${topic || content}" in #${issueNo} is removed`
  );
  const comments = await getComments(issueNo);
  let commentId: number | null = null;

  const byTopic = (comment: Comment): boolean =>
    comment.body.startsWith(`### ${topic}\n\n`);
  const byContent = (comment: Comment): boolean =>
    comment.body.trim() === content;

  if (topic) {
    commentId = comments.find(byTopic)?.id;
  } else if (content) {
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

// Creates PR and returns PR number
export async function createPr({
  branchName,
  targetBranch,
  prTitle: title,
  prBody: rawBody,
  labels,
  platformOptions = {},
  draftPR = false,
}: CreatePRConfig): Promise<Pr> {
  const body = sanitize(rawBody);
  const base = targetBranch;
  // Include the repository owner to handle forkMode and regular mode
  const head = `${config.repository.split('/')[0]}:${branchName}`;
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
  const pr = (
    await githubApi.postJson<GhPr>(
      `repos/${config.parentRepo || config.repository}/pulls`,
      options
    )
  ).body;
  logger.debug(
    { branch: branchName, pr: pr.number, draft: draftPR },
    'PR created'
  );
  // istanbul ignore if
  if (config.prList) {
    config.prList.push(pr);
  }
  pr.displayNumber = `Pull Request #${pr.number}`;
  pr.branchName = branchName;
  await addLabels(pr.number, labels);
  if (platformOptions.statusCheckVerify) {
    logger.debug('Setting statusCheckVerify');
    await setBranchStatus({
      branchName,
      context: `renovate/verify`,
      description: `Renovate verified pull request`,
      state: BranchStatus.green,
      url: 'https://github.com/renovatebot/renovate',
    });
  }
  return pr;
}

export async function updatePr(
  prNo: number,
  title: string,
  rawBody?: string
): Promise<void> {
  logger.debug(`updatePr(${prNo}, ${title}, body)`);
  const body = sanitize(rawBody);
  const patchBody: any = { title };
  if (body) {
    patchBody.body = body;
  }
  const options: any = {
    body: patchBody,
  };
  // istanbul ignore if
  if (config.forkToken) {
    options.token = config.forkToken;
  }
  try {
    await githubApi.patchJson(
      `repos/${config.parentRepo || config.repository}/pulls/${prNo}`,
      options
    );
    logger.debug({ pr: prNo }, 'PR updated');
  } catch (err) /* istanbul ignore next */ {
    if (err instanceof ExternalHostError) {
      throw err;
    }
    logger.warn({ err }, 'Error updating PR');
  }
}

export async function mergePr(
  prNo: number,
  branchName: string
): Promise<boolean> {
  logger.debug(`mergePr(${prNo}, ${branchName})`);
  // istanbul ignore if
  if (config.prReviewsRequired) {
    logger.debug(
      { branch: branchName, prNo },
      'Branch protection: Attempting to merge PR when PR reviews are enabled'
    );
    const repository = config.parentRepo || config.repository;
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
    config.parentRepo || config.repository
  }/pulls/${prNo}/merge`;
  const options = {
    body: {} as any,
  };
  let automerged = false;
  if (config.mergeMethod) {
    // This path is taken if we have auto-detected the allowed merge types from the repo
    options.body.merge_method = config.mergeMethod;
    try {
      logger.debug({ options, url }, `mergePr`);
      await githubApi.putJson(url, options);
      automerged = true;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 405) {
        // istanbul ignore next
        logger.debug(
          { response: err.response ? err.response.body : undefined },
          'GitHub blocking PR merge -- will keep trying'
        );
      } else {
        logger.warn({ err }, `Failed to ${options.body.merge_method} merge PR`);
        return false;
      }
    }
  }
  if (!automerged) {
    // We need to guess the merge method and try squash -> rebase -> merge
    options.body.merge_method = 'rebase';
    try {
      logger.debug({ options, url }, `mergePr`);
      await githubApi.putJson(url, options);
    } catch (err1) {
      logger.debug(
        { err: err1 },
        `Failed to ${options.body.merge_method} merge PR`
      );
      try {
        options.body.merge_method = 'squash';
        logger.debug({ options, url }, `mergePr`);
        await githubApi.putJson(url, options);
      } catch (err2) {
        logger.debug(
          { err: err2 },
          `Failed to ${options.body.merge_method} merge PR`
        );
        try {
          options.body.merge_method = 'merge';
          logger.debug({ options, url }, `mergePr`);
          await githubApi.putJson(url, options);
        } catch (err3) {
          logger.debug(
            { err: err3 },
            `Failed to ${options.body.merge_method} merge PR`
          );
          logger.debug({ pr: prNo }, 'All merge attempts failed');
          return false;
        }
      }
    }
  }
  logger.debug({ pr: prNo }, 'PR merged');
  // Delete branch
  await deleteBranch(branchName);
  return true;
}

export function getPrBody(input: string): string {
  if (config.isGhe) {
    return smartTruncate(input, 60000);
  }
  const massagedInput = input
    // to be safe, replace all github.com links with renovatebot redirector
    .replace(/href="https?:\/\/github.com\//g, 'href="https://togithub.com/')
    .replace(/]\(https:\/\/github\.com\//g, '](https://togithub.com/')
    .replace(/]: https:\/\/github\.com\//g, ']: https://togithub.com/');
  return smartTruncate(massagedInput, 60000);
}

export async function getVulnerabilityAlerts(): Promise<VulnerabilityAlert[]> {
  // prettier-ignore
  const query = `
  query {
    repository(owner:"${config.repositoryOwner}", name:"${config.repositoryName}") {
      vulnerabilityAlerts(last: 100) {
        edges {
          node {
            dismissReason
            vulnerableManifestFilename
            vulnerableManifestPath
            vulnerableRequirements
            securityAdvisory {
              description
              identifiers { type value }
              references { url }
              severity
            }
            securityVulnerability {
              package { name ecosystem }
              firstPatchedVersion { identifier }
              vulnerableVersionRange
            }
          }
        }
      }
    }
  }`;
  let alerts = [];
  try {
    const vulnerabilityAlerts = await githubApi.queryRepoField<{ node: any }>(
      query,
      'vulnerabilityAlerts',
      {
        paginate: false,
        acceptHeader: 'application/vnd.github.vixen-preview+json',
      }
    );
    if (vulnerabilityAlerts?.length) {
      alerts = vulnerabilityAlerts.map((edge) => edge.node);
      if (alerts.length) {
        logger.debug({ alerts }, 'Found GitHub vulnerability alerts');
      }
    } else {
      logger.debug('Cannot read vulnerability alerts');
    }
  } catch (err) {
    logger.debug({ err }, 'Error retrieving vulnerability alerts');
  }
  return alerts;
}
