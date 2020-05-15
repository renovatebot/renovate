import URL from 'url';
import is from '@sindresorhus/is';
import delay from 'delay';
import { configFileNames } from '../../config/app-strings';
import {
  PLATFORM_FAILURE,
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
import * as hostRules from '../../util/host-rules';
import { sanitize } from '../../util/sanitize';
import { ensureTrailingSlash } from '../../util/url';
import {
  BranchStatusConfig,
  CommitFilesConfig,
  CreatePRConfig,
  EnsureCommentConfig,
  EnsureCommentRemovalConfig,
  EnsureIssueConfig,
  EnsureIssueResult,
  FindPRConfig,
  Issue,
  PlatformConfig,
  Pr,
  RepoConfig,
  RepoParams,
  VulnerabilityAlert,
} from '../common';
import GitStorage, { StatusResult } from '../git/storage';
import { smartTruncate } from '../utils/pr-body';
import { api } from './gh-got-wrapper';
import { getGraphqlNodes } from './gh-graphql-wrapper';
import {
  BranchProtection,
  CombinedBranchStatus,
  Comment,
  GhBranchStatus,
  GhPr,
  LocalRepoConfig,
  PrList,
} from './types';

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
}: {
  endpoint: string;
  token: string;
}): Promise<PlatformConfig> {
  if (!token) {
    throw new Error('Init: You must configure a GitHub personal access token');
  }

  if (endpoint) {
    defaults.endpoint = ensureTrailingSlash(endpoint);
    api.setBaseUrl(defaults.endpoint);
  } else {
    logger.debug('Using default github endpoint: ' + defaults.endpoint);
  }
  let gitAuthor: string;
  let renovateUsername: string;
  try {
    const userData = (
      await api.get(defaults.endpoint + 'user', {
        token,
      })
    ).body;
    renovateUsername = userData.login;
    gitAuthor = userData.name;
  } catch (err) {
    logger.debug({ err }, 'Error authenticating with GitHub');
    throw new Error('Init: Authentication failure');
  }
  try {
    const userEmail = (
      await api.get(defaults.endpoint + 'user/emails', {
        token,
      })
    ).body;
    if (userEmail.length && userEmail[0].email) {
      gitAuthor += ` <${userEmail[0].email}>`;
    } else {
      logger.debug('Cannot find an email address for Renovate user');
      gitAuthor = undefined;
    }
  } catch (err) {
    logger.debug(
      'Cannot read user/emails endpoint on GitHub to retrieve gitAuthor'
    );
    gitAuthor = undefined;
  }
  logger.debug('Authenticated as GitHub user: ' + renovateUsername);
  const platformConfig: PlatformConfig = {
    endpoint: defaults.endpoint,
    gitAuthor,
    renovateUsername,
  };
  return platformConfig;
}

// Get all repositories that the user has access to
export async function getRepos(): Promise<string[]> {
  logger.debug('Autodiscovering GitHub repositories');
  try {
    const res = await api.get('user/repos?per_page=100', { paginate: true });
    return res.body.map((repo: { full_name: string }) => repo.full_name);
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, `GitHub getRepos error`);
    throw err;
  }
}

export function cleanRepo(): Promise<void> {
  // istanbul ignore if
  if (config.storage) {
    config.storage.cleanRepo();
  }
  // In theory most of this isn't necessary. In practice..
  config = {} as any;
  return Promise.resolve();
}

async function getBranchProtection(
  branchName: string
): Promise<BranchProtection> {
  // istanbul ignore if
  if (config.parentRepo) {
    return {};
  }
  const res = await api.get(
    `repos/${config.repository}/branches/${escapeHash(branchName)}/protection`
  );
  return res.body;
}

// Return the commit SHA for a branch
async function getBranchCommit(branchName: string): Promise<string> {
  try {
    const res = await api.get(
      `repos/${config.repository}/git/refs/heads/${escapeHash(branchName)}`
    );
    return res.body.object.sha;
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err }, 'Error getting branch commit');
    if (err.statusCode === 404) {
      throw new Error(REPOSITORY_CHANGED);
    }
    if (err.statusCode === 409) {
      throw new Error(REPOSITORY_EMPTY);
    }
    throw err;
  }
}

async function getBaseCommitSHA(): Promise<string> {
  if (!config.baseCommitSHA) {
    config.baseCommitSHA = await getBranchCommit(config.baseBranch);
  }
  return config.baseCommitSHA;
}

// Initialize GitHub by getting base branch and SHA
export async function initRepo({
  endpoint,
  repository,
  forkMode,
  forkToken,
  gitPrivateKey,
  localDir,
  includeForks,
  renovateUsername,
  optimizeForDisabled,
}: RepoParams): Promise<RepoConfig> {
  logger.debug(`initRepo("${repository}")`);
  // config is used by the platform api itself, not necessary for the app layer to know
  await cleanRepo();
  // istanbul ignore if
  if (endpoint) {
    // Necessary for Renovate Pro - do not remove
    logger.debug('Overriding default GitHub endpoint');
    defaults.endpoint = endpoint;
    api.setBaseUrl(endpoint);
  }
  const opts = hostRules.find({
    hostType: PLATFORM_TYPE_GITHUB,
    url: defaults.endpoint,
  });
  config.isGhe = URL.parse(defaults.endpoint).host !== 'api.github.com';
  config.renovateUsername = renovateUsername;
  config.localDir = localDir;
  config.repository = repository;
  [config.repositoryOwner, config.repositoryName] = repository.split('/');
  config.gitPrivateKey = gitPrivateKey;
  let res;
  try {
    res = await api.get(`repos/${repository}`);
    logger.trace({ repositoryDetails: res.body }, 'Repository details');
    config.enterpriseVersion =
      res.headers && (res.headers['x-github-enterprise-version'] as string);
    // istanbul ignore if
    if (res.body.fork && !includeForks) {
      try {
        const renovateConfig = JSON.parse(
          Buffer.from(
            (
              await api.get(
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
    if (res.body.full_name && res.body.full_name !== repository) {
      logger.debug(
        { repository, this_repository: res.body.full_name },
        'Repository has been renamed'
      );
      throw new Error(REPOSITORY_RENAMED);
    }
    if (res.body.archived) {
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
              await api.get(
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
    const owner = res.body.owner.login;
    logger.debug(`${repository} owner = ${owner}`);
    // Use default branch as PR target unless later overridden.
    config.defaultBranch = res.body.default_branch;
    // Base branch may be configured but defaultBranch is always fixed
    config.baseBranch = config.defaultBranch;
    logger.debug(`${repository} default branch = ${config.baseBranch}`);
    // GitHub allows administrators to block certain types of merge, so we need to check it
    if (res.body.allow_rebase_merge) {
      config.mergeMethod = 'rebase';
    } else if (res.body.allow_squash_merge) {
      config.mergeMethod = 'squash';
    } else if (res.body.allow_merge_commit) {
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
    // Save parent SHA then delete
    const parentSha = await getBaseCommitSHA();
    config.baseCommitSHA = null;
    // save parent name then delete
    config.parentRepo = config.repository;
    config.repository = null;
    // Get list of existing repos
    const existingRepos = (
      await api.get<{ full_name: string }[]>('user/repos?per_page=100', {
        token: forkToken || opts.token,
        paginate: true,
      })
    ).body.map((r) => r.full_name);
    try {
      config.repository = (
        await api.post(`repos/${repository}/forks`, {
          token: forkToken || opts.token,
        })
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
        { baseBranch: config.baseBranch, parentSha },
        'Setting baseBranch ref in fork'
      );
      // This is a lovely "hack" by GitHub that lets us force update our fork's master
      // with the base commit from the parent repository
      try {
        await api.patch(
          `repos/${config.repository}/git/refs/heads/${config.baseBranch}`,
          {
            body: {
              sha: parentSha,
              force: true,
            },
            token: forkToken || opts.token,
          }
        );
      } catch (err) /* istanbul ignore next */ {
        if (err.message === PLATFORM_FAILURE) {
          throw err;
        }
        if (
          err.statusCode === 422 &&
          err.message.startsWith('Object does not exist')
        ) {
          throw new Error(REPOSITORY_CHANGED);
        }
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
  config.storage = new GitStorage();
  await config.storage.initRepo({
    ...config,
    url,
  });
  const repoConfig: RepoConfig = {
    baseBranch: config.baseBranch,
    isFork: res.body.fork === true,
  };
  return repoConfig;
}

export async function getRepoForceRebase(): Promise<boolean> {
  if (config.repoForceRebase === undefined) {
    try {
      config.repoForceRebase = false;
      const branchProtection = await getBranchProtection(config.baseBranch);
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
export async function setBaseBranch(
  branchName = config.baseBranch
): Promise<string> {
  config.baseBranch = branchName;
  config.baseCommitSHA = null;
  const baseBranchSha = await config.storage.setBaseBranch(branchName);
  return baseBranchSha;
}

// istanbul ignore next
export function setBranchPrefix(branchPrefix: string): Promise<void> {
  return config.storage.setBranchPrefix(branchPrefix);
}

// Search

// istanbul ignore next
export function getFileList(): Promise<string[]> {
  return config.storage.getFileList();
}

// Branch

// istanbul ignore next
export function branchExists(branchName: string): Promise<boolean> {
  return config.storage.branchExists(branchName);
}

// istanbul ignore next
export function getAllRenovateBranches(
  branchPrefix: string
): Promise<string[]> {
  return config.storage.getAllRenovateBranches(branchPrefix);
}

// istanbul ignore next
export function isBranchStale(branchName: string): Promise<boolean> {
  return config.storage.isBranchStale(branchName);
}

// istanbul ignore next
export function getFile(
  filePath: string,
  branchName?: string
): Promise<string> {
  return config.storage.getFile(filePath, branchName);
}

// istanbul ignore next
export function deleteBranch(
  branchName: string,
  closePr?: boolean
): Promise<void> {
  return config.storage.deleteBranch(branchName);
}

// istanbul ignore next
export function getBranchLastCommitTime(branchName: string): Promise<Date> {
  return config.storage.getBranchLastCommitTime(branchName);
}

// istanbul ignore next
export function getRepoStatus(): Promise<StatusResult> {
  return config.storage.getRepoStatus();
}

// istanbul ignore next
export function mergeBranch(branchName: string): Promise<void> {
  if (config.pushProtection) {
    logger.debug(
      { branch: branchName },
      'Branch protection: Attempting to merge branch when push protection is enabled'
    );
  }
  return config.storage.mergeBranch(branchName);
}

// istanbul ignore next
export function commitFiles({
  branchName,
  files,
  message,
}: CommitFilesConfig): Promise<string | null> {
  return config.storage.commitFiles({
    branchName,
    files,
    message,
  });
}

// istanbul ignore next
export function getCommitMessages(): Promise<string[]> {
  return config.storage.getCommitMessages();
}

async function getClosedPrs(): Promise<PrList> {
  if (!config.closedPrList) {
    config.closedPrList = {};
    let query;
    try {
      const url = 'graphql';
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
      const options = {
        body: JSON.stringify({ query }),
        json: false,
      };
      const res = JSON.parse((await api.post(url, options)).body);
      const prNumbers: number[] = [];
      // istanbul ignore if
      if (!res.data) {
        logger.debug(
          { query, res },
          'No graphql res.data, returning empty list'
        );
        return {};
      }
      for (const pr of res.data.repository.pullRequests.nodes) {
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
      const url = 'graphql';
      // https://developer.github.com/v4/previews/#mergeinfopreview---more-detailed-information-about-a-pull-requests-merge-state
      const headers = {
        accept: 'application/vnd.github.merge-info-preview+json',
      };
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
      const options = {
        headers,
        body: JSON.stringify({ query }),
        json: false,
      };
      const res = JSON.parse((await api.post(url, options)).body);
      const prNumbers: number[] = [];
      // istanbul ignore if
      if (!res.data) {
        logger.debug({ query, res }, 'No graphql res.data');
        return {};
      }
      for (const pr of res.data.repository.pullRequests.nodes) {
        // https://developer.github.com/v4/object/pullrequest/
        pr.displayNumber = `Pull Request #${pr.number}`;
        pr.state = PR_STATE_OPEN;
        pr.branchName = pr.headRefName;
        const branchName = pr.branchName;
        const prNo = pr.number;
        delete pr.headRefName;
        pr.targetBranch = pr.baseRefName;
        delete pr.baseRefName;
        // https://developer.github.com/v4/enum/mergeablestate
        const canMergeStates = ['BEHIND', 'CLEAN'];
        const hasNegativeReview =
          pr.reviews && pr.reviews.nodes && pr.reviews.nodes.length > 0;
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
        if (pr.commits.nodes.length === 1) {
          if (global.gitAuthor) {
            // Check against gitAuthor
            const commitAuthorEmail = pr.commits.nodes[0].commit.author.email;
            if (commitAuthorEmail === global.gitAuthor.email) {
              pr.isModified = false;
            } else {
              logger.trace(
                {
                  branchName,
                  prNo,
                  commitAuthorEmail,
                  gitAuthorEmail: global.gitAuthor.email,
                },
                'PR isModified=true: last committer has different email to the bot'
              );
              pr.isModified = true;
            }
          } else {
            // assume the author is us
            // istanbul ignore next
            pr.isModified = false;
          }
        } else {
          // assume we can't rebase if more than 1
          logger.trace(
            {
              branchName,
              prNo,
            },
            'PR isModified=true: PR has more than one commit'
          );
          pr.isModified = true;
        }
        pr.isStale = false;
        if (pr.mergeStateStatus === 'BEHIND') {
          pr.isStale = true;
        } else {
          const baseCommitSHA = await getBaseCommitSHA();
          if (
            pr.commits.nodes[0].commit.parents.edges.length &&
            pr.commits.nodes[0].commit.parents.edges[0].node.oid !==
              baseCommitSHA
          ) {
            pr.isStale = true;
          }
        }
        if (pr.labels) {
          pr.labels = pr.labels.nodes.map(
            (label: { name: string }) => label.name
          );
        }
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
  const openPr = (await getOpenPrs())[prNo];
  if (openPr) {
    logger.debug('Returning from graphql open PR list');
    return openPr;
  }
  const closedPr = (await getClosedPrs())[prNo];
  if (closedPr) {
    logger.debug('Returning from graphql closed PR list');
    return closedPr;
  }
  logger.debug(
    { prNo },
    'PR not found in open or closed PRs list - trying to fetch it directly'
  );
  const pr = (
    await api.get(
      `repos/${config.parentRepo || config.repository}/pulls/${prNo}`
    )
  ).body;
  if (!pr) {
    return null;
  }
  // Harmonise PR values
  pr.displayNumber = `Pull Request #${pr.number}`;
  if (pr.state === PR_STATE_OPEN) {
    pr.isModified = true;
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
    if (pr.commits === 1) {
      if (global.gitAuthor) {
        // Check against gitAuthor
        const commitAuthorEmail = (
          await api.get(
            `repos/${
              config.parentRepo || config.repository
            }/pulls/${prNo}/commits`
          )
        ).body[0].commit.author.email;
        if (commitAuthorEmail === global.gitAuthor.email) {
          logger.debug(
            { prNo },
            '1 commit matches configured gitAuthor so can rebase'
          );
          pr.isModified = false;
        } else {
          logger.trace(
            {
              prNo,
              commitAuthorEmail,
              gitAuthorEmail: global.gitAuthor.email,
            },
            'PR isModified=true: 1 commit and not by configured gitAuthor so cannot rebase'
          );
          pr.isModified = true;
        }
      } else {
        logger.debug(
          { prNo },
          '1 commit and no configured gitAuthor so can rebase'
        );
        pr.isModified = false;
      }
    } else {
      // Check if only one author of all commits
      logger.debug({ prNo }, 'Checking all commits');
      const prCommits = (
        await api.get(
          `repos/${
            config.parentRepo || config.repository
          }/pulls/${prNo}/commits`
        )
      ).body;
      // Filter out "Update branch" presses
      const remainingCommits = prCommits.filter(
        (commit: {
          committer: { login: string };
          commit: { message: string };
        }) => {
          const isWebflow =
            commit.committer && commit.committer.login === 'web-flow';
          if (!isWebflow) {
            // Not a web UI commit, so keep it
            return true;
          }
          const isUpdateBranch =
            commit.commit &&
            commit.commit.message &&
            commit.commit.message.startsWith("Merge branch 'master' into");
          if (isUpdateBranch) {
            // They just clicked the button
            return false;
          }
          // They must have done some other edit through the web UI
          return true;
        }
      );
      if (remainingCommits.length <= 1) {
        pr.isModified = false;
      }
    }
    const baseCommitSHA = await getBaseCommitSHA();
    if (!pr.base || pr.base.sha !== baseCommitSHA) {
      pr.isStale = true;
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
      res = await api.get(
        `repos/${
          config.parentRepo || config.repository
        }/pulls?per_page=100&state=all`,
        { paginate: true }
      );
    } catch (err) /* istanbul ignore next */ {
      logger.debug({ err }, 'getPrList err');
      throw new Error('platform-failure');
    }
    config.prList = res.body.map(
      (pr: {
        number: number;
        head: { ref: string; sha: string; repo: { full_name: string } };
        title: string;
        state: string;
        merged_at: string;
        created_at: string;
        closed_at: string;
      }) => ({
        number: pr.number,
        branchName: pr.head.ref,
        sha: pr.head.sha,
        title: pr.title,
        state:
          pr.state === PR_STATE_CLOSED && pr.merged_at && pr.merged_at.length
            ? /* istanbul ignore next */ 'merged'
            : pr.state,
        createdAt: pr.created_at,
        closed_at: pr.closed_at,
        sourceRepo:
          pr.head && pr.head.repo ? pr.head.repo.full_name : undefined,
      })
    );
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

  return (await api.get(commitStatusUrl, { useCache })).body;
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
          Accept: 'application/vnd.github.antiope-preview+json',
        },
      };
      const checkRunsRaw = (await api.get(checkRunsUrl, opts)).body;
      if (checkRunsRaw.check_runs && checkRunsRaw.check_runs.length) {
        checkRuns = checkRunsRaw.check_runs.map(
          (run: { name: string; status: string; conclusion: string }) => ({
            name: run.name,
            status: run.status,
            conclusion: run.conclusion,
          })
        );
        logger.debug({ checkRuns }, 'check runs result');
      } else {
        // istanbul ignore next
        logger.debug({ result: checkRunsRaw }, 'No check runs found');
      }
    } catch (err) /* istanbul ignore next */ {
      if (err.message === PLATFORM_FAILURE) {
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
  const branchCommit = await config.storage.getBranchCommit(branchName);

  const url = `repos/${config.repository}/commits/${branchCommit}/statuses`;

  return (await api.get(url, { useCache })).body;
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
    const branchCommit = await config.storage.getBranchCommit(branchName);
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
    await api.post(url, { body: options });

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

  const result = await getGraphqlNodes<Issue>(query, 'issues');

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
    await api.get(
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
  await api.patch(
    `repos/${config.parentRepo || config.repository}/issues/${issueNumber}`,
    {
      body: { state: 'closed' },
    }
  );
}

export async function ensureIssue({
  title,
  body: rawBody,
  once = false,
  shouldReOpen = true,
}: EnsureIssueConfig): Promise<EnsureIssueResult | null> {
  logger.debug(`ensureIssue(${title})`);
  const body = sanitize(rawBody);
  try {
    const issueList = await getIssueList();
    const issues = issueList.filter((i) => i.title === title);
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
        await api.get(
          `repos/${config.parentRepo || config.repository}/issues/${
            issue.number
          }`
        )
      ).body.body;
      if (issueBody === body && issue.state === 'open') {
        logger.debug('Issue is open and up to date - nothing to do');
        return null;
      }
      if (shouldReOpen) {
        logger.debug('Patching issue');
        await api.patch(
          `repos/${config.parentRepo || config.repository}/issues/${
            issue.number
          }`,
          {
            body: { body, state: 'open' },
          }
        );
        logger.debug('Issue updated');
        return 'updated';
      }
    }
    await api.post(`repos/${config.parentRepo || config.repository}/issues`, {
      body: {
        title,
        body,
      },
    });
    logger.info('Issue created');
    // reset issueList so that it will be fetched again as-needed
    delete config.issueList;
    return 'created';
  } catch (err) /* istanbul ignore next */ {
    if (
      err.body &&
      err.body.message &&
      err.body.message.startsWith('Issues are disabled for this repo')
    ) {
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
  await api.post(`repos/${repository}/issues/${issueNo}/assignees`, {
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
    await api.post(
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
    await api.post(`repos/${repository}/issues/${issueNo}/labels`, {
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
    await api.delete(`repos/${repository}/issues/${issueNo}/labels/${label}`);
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err, issueNo, label }, 'Failed to delete label');
  }
}

async function addComment(issueNo: number, body: string): Promise<void> {
  // POST /repos/:owner/:repo/issues/:number/comments
  await api.post(
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
  await api.patch(
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
  await api.delete(
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
      await api.get<Comment[]>(url, {
        paginate: true,
      })
    ).body;
    logger.debug(`Found ${comments.length} comments`);
    return comments;
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 404) {
      logger.debug('404 respose when retrieving comments');
      throw new Error(PLATFORM_FAILURE);
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
    if (err.message === PLATFORM_FAILURE) {
      throw err;
    }
    if (
      err.message === 'Unable to create comment because issue is locked. (403)'
    ) {
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
  logger.debug(
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
  prTitle: title,
  prBody: rawBody,
  labels,
  useDefaultBranch,
  platformOptions = {},
}: CreatePRConfig): Promise<Pr> {
  const body = sanitize(rawBody);
  const base = useDefaultBranch ? config.defaultBranch : config.baseBranch;
  // Include the repository owner to handle forkMode and regular mode
  const head = `${config.repository.split('/')[0]}:${branchName}`;
  const options: any = {
    body: {
      title,
      head,
      base,
      body,
    },
  };
  // istanbul ignore if
  if (config.forkToken) {
    options.token = config.forkToken;
    options.body.maintainer_can_modify = true;
  }
  logger.debug({ title, head, base }, 'Creating PR');
  const pr = (
    await api.post<GhPr>(
      `repos/${config.parentRepo || config.repository}/pulls`,
      options
    )
  ).body;
  logger.debug({ branch: branchName, pr: pr.number }, 'PR created');
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
  pr.isModified = false;
  return pr;
}

// Return a list of all modified files in a PR
export async function getPrFiles(prNo: number): Promise<string[]> {
  logger.debug({ prNo }, 'getPrFiles');
  if (!prNo) {
    return [];
  }
  const files = (
    await api.get(
      `repos/${config.parentRepo || config.repository}/pulls/${prNo}/files`
    )
  ).body;
  return files.map((f: { filename: string }) => f.filename);
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
    await api.patch(
      `repos/${config.parentRepo || config.repository}/pulls/${prNo}`,
      options
    );
    logger.debug({ pr: prNo }, 'PR updated');
  } catch (err) /* istanbul ignore next */ {
    if (err.message === PLATFORM_FAILURE) {
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
  if (config.isGhe && config.pushProtection) {
    logger.debug(
      { branch: branchName, prNo },
      'Branch protection: Cannot automerge PR when push protection is enabled'
    );
    return false;
  }
  // istanbul ignore if
  if (config.prReviewsRequired) {
    logger.debug(
      { branch: branchName, prNo },
      'Branch protection: Attempting to merge PR when PR reviews are enabled'
    );
    const repository = config.parentRepo || config.repository;
    const reviews = await api.get(`repos/${repository}/pulls/${prNo}/reviews`);
    const isApproved = reviews.body.some(
      (review: { state: string }) => review.state === 'APPROVED'
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
      await api.put(url, options);
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
      await api.put(url, options);
    } catch (err1) {
      logger.debug(
        { err: err1 },
        `Failed to ${options.body.merge_method} merge PR`
      );
      try {
        options.body.merge_method = 'squash';
        logger.debug({ options, url }, `mergePr`);
        await api.put(url, options);
      } catch (err2) {
        logger.debug(
          { err: err2 },
          `Failed to ${options.body.merge_method} merge PR`
        );
        try {
          options.body.merge_method = 'merge';
          logger.debug({ options, url }, `mergePr`);
          await api.put(url, options);
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
  // Update base branch SHA
  config.baseCommitSHA = null;
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
  const headers = {
    accept: 'application/vnd.github.vixen-preview+json',
  };
  const url = 'graphql';
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
  const options = {
    headers,
    body: JSON.stringify({ query }),
    json: false,
  };
  let alerts = [];
  try {
    const res = JSON.parse((await api.post(url, options)).body);
    if (res?.data?.repository?.vulnerabilityAlerts) {
      alerts = res.data.repository.vulnerabilityAlerts.edges.map(
        (edge: { node: any }) => edge.node
      );
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
