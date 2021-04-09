import URL from 'url';
import is from '@sindresorhus/is';
import { lt } from 'semver';
import {
  REPOSITORY_ACCESS_FORBIDDEN,
  REPOSITORY_ARCHIVED,
  REPOSITORY_BLOCKED,
  REPOSITORY_CHANGED,
  REPOSITORY_EMPTY,
  REPOSITORY_MIRRORED,
} from '../../constants/error-messages';
import { PLATFORM_TYPE_GITEA } from '../../constants/platforms';
import { logger } from '../../logger';
import { BranchStatus, PrState, VulnerabilityAlert } from '../../types';
import * as git from '../../util/git';
import * as hostRules from '../../util/host-rules';
import { setBaseUrl } from '../../util/http/gitea';
import { sanitize } from '../../util/sanitize';
import { ensureTrailingSlash } from '../../util/url';
import type {
  BranchStatusConfig,
  CreatePRConfig,
  EnsureCommentConfig,
  EnsureCommentRemovalConfig,
  EnsureIssueConfig,
  FindPRConfig,
  Issue,
  Platform,
  PlatformParams,
  PlatformResult,
  Pr,
  RepoParams,
  RepoResult,
  UpdatePrConfig,
} from '../types';
import { smartTruncate } from '../utils/pr-body';
import * as helper from './gitea-helper';
import { smartLinks } from './utils';

interface GiteaRepoConfig {
  repository: string;
  localDir: string;
  mergeMethod: helper.PRMergeMethod;

  prList: Promise<Pr[]> | null;
  issueList: Promise<Issue[]> | null;
  labelList: Promise<helper.Label[]> | null;
  defaultBranch: string;
  cloneSubmodules: boolean;
}

const defaults = {
  hostType: PLATFORM_TYPE_GITEA,
  endpoint: 'https://gitea.com/api/v1/',
  version: '0.0.0',
};

let config: GiteaRepoConfig = {} as any;
let botUserID: number;
let botUserName: string;

function toRenovateIssue(data: helper.Issue): Issue {
  return {
    number: data.number,
    state: data.state,
    title: data.title,
    body: data.body,
  };
}

function toRenovatePR(data: helper.PR): Pr | null {
  if (!data) {
    return null;
  }

  if (
    !data.base?.ref ||
    !data.head?.label ||
    !data.head?.sha ||
    !data.head?.repo?.full_name
  ) {
    logger.trace(
      `Skipping Pull Request #${data.number} due to missing base and/or head branch`
    );
    return null;
  }

  const createdBy = data.user?.username;
  if (createdBy && botUserName && createdBy !== botUserName) {
    return null;
  }

  return {
    number: data.number,
    displayNumber: `Pull Request #${data.number}`,
    state: data.state,
    title: data.title,
    body: data.body,
    sha: data.head.sha,
    sourceBranch: data.head.label,
    targetBranch: data.base.ref,
    sourceRepo: data.head.repo.full_name,
    createdAt: data.created_at,
    canMerge: data.mergeable,
    isConflicted: !data.mergeable,
    hasAssignees: !!(data.assignee?.login || is.nonEmptyArray(data.assignees)),
  };
}

function matchesState(actual: string, expected: string): boolean {
  if (expected === PrState.All) {
    return true;
  }
  if (expected.startsWith('!')) {
    return actual !== expected.substring(1);
  }

  return actual === expected;
}

function findCommentByTopic(
  comments: helper.Comment[],
  topic: string
): helper.Comment | null {
  return comments.find((c) => c.body.startsWith(`### ${topic}\n\n`));
}

function findCommentByContent(
  comments: helper.Comment[],
  content: string
): helper.Comment | null {
  return comments.find((c) => c.body.trim() === content);
}

function getLabelList(): Promise<helper.Label[]> {
  if (config.labelList === null) {
    const repoLabels = helper
      .getRepoLabels(config.repository, {
        useCache: false,
      })
      .then((labels) => {
        logger.debug(`Retrieved ${labels.length} repo labels`);
        return labels;
      });

    const orgLabels = helper
      .getOrgLabels(config.repository.split('/')[0], {
        useCache: false,
      })
      .then((labels) => {
        logger.debug(`Retrieved ${labels.length} org labels`);
        return labels;
      })
      .catch((err) => {
        // Will fail if owner of repo is not org or Gitea version < 1.12
        logger.debug(`Unable to fetch organization labels`);
        return [];
      });

    config.labelList = Promise.all([repoLabels, orgLabels]).then((labels) =>
      [].concat(...labels)
    );
  }

  return config.labelList;
}

async function lookupLabelByName(name: string): Promise<number | null> {
  logger.debug(`lookupLabelByName(${name})`);
  const labelList = await getLabelList();
  return labelList.find((l) => l.name === name)?.id;
}

const platform: Platform = {
  async initPlatform({
    endpoint,
    token,
  }: PlatformParams): Promise<PlatformResult> {
    if (!token) {
      throw new Error('Init: You must configure a Gitea personal access token');
    }

    if (endpoint) {
      defaults.endpoint = ensureTrailingSlash(endpoint);
    } else {
      logger.debug('Using default Gitea endpoint: ' + defaults.endpoint);
    }
    setBaseUrl(defaults.endpoint);

    let gitAuthor: string;
    try {
      const user = await helper.getCurrentUser({ token });
      gitAuthor = `${user.full_name || user.username} <${user.email}>`;
      botUserID = user.id;
      botUserName = user.username;
      defaults.version = await helper.getVersion({ token });
    } catch (err) {
      logger.debug(
        { err },
        'Error authenticating with Gitea. Check your token'
      );
      throw new Error('Init: Authentication failure');
    }

    return {
      endpoint: defaults.endpoint,
      gitAuthor,
    };
  },

  async getRawFile(
    fileName: string,
    repo: string = config.repository
  ): Promise<string | null> {
    const contents = await helper.getRepoContents(repo, fileName);
    return contents.contentString;
  },

  async getJsonFile(
    fileName: string,
    repo: string = config.repository
  ): Promise<any | null> {
    const raw = await platform.getRawFile(fileName, repo);
    return JSON.parse(raw);
  },

  async initRepo({
    repository,
    localDir,
    cloneSubmodules,
  }: RepoParams): Promise<RepoResult> {
    let repo: helper.Repo;

    config = {} as any;
    config.repository = repository;
    config.localDir = localDir;
    config.cloneSubmodules = cloneSubmodules;

    // Attempt to fetch information about repository
    try {
      repo = await helper.getRepo(repository);
    } catch (err) {
      logger.debug({ err }, 'Unknown Gitea initRepo error');
      throw err;
    }

    // Ensure appropriate repository state and permissions
    if (repo.archived) {
      logger.debug(
        'Repository is archived - throwing error to abort renovation'
      );
      throw new Error(REPOSITORY_ARCHIVED);
    }
    if (repo.mirror) {
      logger.debug(
        'Repository is a mirror - throwing error to abort renovation'
      );
      throw new Error(REPOSITORY_MIRRORED);
    }
    if (!repo.permissions.pull || !repo.permissions.push) {
      logger.debug(
        'Repository does not permit pull and push - throwing error to abort renovation'
      );
      throw new Error(REPOSITORY_ACCESS_FORBIDDEN);
    }
    if (repo.empty) {
      logger.debug('Repository is empty - throwing error to abort renovation');
      throw new Error(REPOSITORY_EMPTY);
    }

    if (repo.allow_rebase) {
      config.mergeMethod = 'rebase';
    } else if (repo.allow_rebase_explicit) {
      config.mergeMethod = 'rebase-merge';
    } else if (repo.allow_squash_merge) {
      config.mergeMethod = 'squash';
    } else if (repo.allow_merge_commits) {
      config.mergeMethod = 'merge';
    } else {
      logger.debug(
        'Repository has no allowed merge methods - throwing error to abort renovation'
      );
      throw new Error(REPOSITORY_BLOCKED);
    }

    // Determine author email and branches
    config.defaultBranch = repo.default_branch;
    logger.debug(`${repository} default branch = ${config.defaultBranch}`);

    // Find options for current host and determine Git endpoint
    const opts = hostRules.find({
      hostType: PLATFORM_TYPE_GITEA,
      url: defaults.endpoint,
    });
    const gitEndpoint = URL.parse(repo.clone_url);
    gitEndpoint.auth = opts.token;

    // Initialize Git storage
    await git.initRepo({
      ...config,
      url: URL.format(gitEndpoint),
      gitAuthorName: global.gitAuthor?.name,
      gitAuthorEmail: global.gitAuthor?.email,
    });

    // Reset cached resources
    config.prList = null;
    config.issueList = null;
    config.labelList = null;

    return {
      defaultBranch: config.defaultBranch,
      isFork: !!repo.fork,
    };
  },

  async getRepos(): Promise<string[]> {
    logger.debug('Auto-discovering Gitea repositories');
    try {
      const repos = await helper.searchRepos({
        uid: botUserID,
        archived: false,
      });
      return repos.map((r) => r.full_name);
    } catch (err) {
      logger.error({ err }, 'Gitea getRepos() error');
      throw err;
    }
  },

  async setBranchStatus({
    branchName,
    context,
    description,
    state,
    url: target_url,
  }: BranchStatusConfig): Promise<void> {
    try {
      // Create new status for branch commit
      const branchCommit = git.getBranchCommit(branchName);
      await helper.createCommitStatus(config.repository, branchCommit, {
        state: helper.renovateToGiteaStatusMapping[state] || 'pending',
        context,
        description,
        ...(target_url && { target_url }),
      });

      // Refresh caches by re-fetching commit status for branch
      await helper.getCombinedCommitStatus(config.repository, branchName, {
        useCache: false,
      });
    } catch (err) {
      logger.warn({ err }, 'Failed to set branch status');
    }
  },

  async getBranchStatus(
    branchName: string,
    requiredStatusChecks?: string[] | null
  ): Promise<BranchStatus> {
    if (!requiredStatusChecks) {
      return BranchStatus.green;
    }

    if (Array.isArray(requiredStatusChecks) && requiredStatusChecks.length) {
      logger.warn({ requiredStatusChecks }, 'Unsupported requiredStatusChecks');
      return BranchStatus.red;
    }

    let ccs: helper.CombinedCommitStatus;
    try {
      ccs = await helper.getCombinedCommitStatus(config.repository, branchName);
    } catch (err) {
      if (err.statusCode === 404) {
        logger.debug(
          'Received 404 when checking branch status, assuming branch deletion'
        );
        throw new Error(REPOSITORY_CHANGED);
      }

      logger.debug('Unknown error when checking branch status');
      throw err;
    }

    logger.debug({ ccs }, 'Branch status check result');
    return (
      helper.giteaToRenovateStatusMapping[ccs.worstStatus] ||
      BranchStatus.yellow
    );
  },

  async getBranchStatusCheck(
    branchName: string,
    context: string
  ): Promise<BranchStatus | null> {
    const ccs = await helper.getCombinedCommitStatus(
      config.repository,
      branchName
    );
    const cs = ccs.statuses.find((s) => s.context === context);
    if (!cs) {
      return null;
    } // no status check exists
    const status = helper.giteaToRenovateStatusMapping[cs.status];
    if (status) {
      return status;
    }
    logger.warn(
      { check: cs },
      'Could not map Gitea status value to Renovate status'
    );
    return BranchStatus.yellow;
  },

  getPrList(): Promise<Pr[]> {
    if (config.prList === null) {
      config.prList = helper
        .searchPRs(
          config.repository,
          { state: PrState.All },
          { useCache: false }
        )
        .then((prs) => {
          const prList = prs.map(toRenovatePR).filter(Boolean);
          logger.debug(`Retrieved ${prList.length} Pull Requests`);
          return prList;
        });
    }

    return config.prList;
  },

  async getPr(number: number): Promise<Pr | null> {
    // Search for pull request in cached list or attempt to query directly
    const prList = await platform.getPrList();
    let pr = prList.find((p) => p.number === number);
    if (pr) {
      logger.debug('Returning from cached PRs');
    } else {
      logger.debug('PR not found in cached PRs - trying to fetch directly');
      const gpr = await helper.getPR(config.repository, number);
      pr = toRenovatePR(gpr);

      // Add pull request to cache for further lookups / queries
      if (config.prList !== null) {
        (await config.prList).push(pr);
      }
    }

    // Abort and return null if no match was found
    if (!pr) {
      return null;
    }

    return pr;
  },

  async findPr({
    branchName,
    prTitle: title,
    state = PrState.All,
  }: FindPRConfig): Promise<Pr> {
    logger.debug(`findPr(${branchName}, ${title}, ${state})`);
    const prList = await platform.getPrList();
    const pr = prList.find(
      (p) =>
        p.sourceRepo === config.repository &&
        p.sourceBranch === branchName &&
        matchesState(p.state, state) &&
        (!title || p.title === title)
    );

    if (pr) {
      logger.debug(`Found PR #${pr.number}`);
    }
    return pr ?? null;
  },

  async createPr({
    sourceBranch,
    targetBranch,
    prTitle: title,
    prBody: rawBody,
    labels: labelNames,
  }: CreatePRConfig): Promise<Pr> {
    const base = targetBranch;
    const head = sourceBranch;
    const body = sanitize(rawBody);

    logger.debug(`Creating pull request: ${title} (${head} => ${base})`);
    try {
      const labels = Array.isArray(labelNames)
        ? await Promise.all(labelNames.map(lookupLabelByName))
        : [];
      const gpr = await helper.createPR(config.repository, {
        base,
        head,
        title,
        body,
        labels: labels.filter(Boolean),
      });

      const pr = toRenovatePR(gpr);
      if (!pr) {
        throw new Error('Can not parse newly created Pull Request');
      }
      if (config.prList !== null) {
        (await config.prList).push(pr);
      }

      return pr;
    } catch (err) {
      // When the user manually deletes a branch from Renovate, the PR remains but is no longer linked to any branch. In
      // the most recent versions of Gitea, the PR gets automatically closed when that happens, but older versions do
      // not handle this properly and keep the PR open. As pushing a branch with the same name resurrects the PR, this
      // would cause a HTTP 409 conflict error, which we hereby gracefully handle.
      if (err.statusCode === 409) {
        logger.warn(
          `Attempting to gracefully recover from 409 Conflict response in createPr(${title}, ${sourceBranch})`
        );

        // Refresh cached PR list and search for pull request with matching information
        config.prList = null;
        const pr = await platform.findPr({
          branchName: sourceBranch,
          state: PrState.Open,
        });

        // If a valid PR was found, return and gracefully recover from the error. Otherwise, abort and throw error.
        if (pr) {
          if (pr.title !== title || pr.body !== body) {
            logger.debug(
              `Recovered from 409 Conflict, but PR for ${sourceBranch} is outdated. Updating...`
            );
            await platform.updatePr({
              number: pr.number,
              prTitle: title,
              prBody: body,
            });
            pr.title = title;
            pr.body = body;
          } else {
            logger.debug(
              `Recovered from 409 Conflict and PR for ${sourceBranch} is up-to-date`
            );
          }

          return pr;
        }
      }

      throw err;
    }
  },

  async updatePr({
    number,
    prTitle: title,
    prBody: body,
    state,
  }: UpdatePrConfig): Promise<void> {
    await helper.updatePR(config.repository, number, {
      title,
      ...(body && { body }),
      ...(state && { state }),
    });
  },

  async mergePr(number: number, branchName: string): Promise<boolean> {
    try {
      await helper.mergePR(config.repository, number, config.mergeMethod);
      return true;
    } catch (err) {
      logger.warn({ err, number }, 'Merging of PR failed');
      return false;
    }
  },

  getIssueList(): Promise<Issue[]> {
    if (config.issueList === null) {
      config.issueList = helper
        .searchIssues(config.repository, { state: 'all' }, { useCache: false })
        .then((issues) => {
          const issueList = issues.map(toRenovateIssue);
          logger.debug(`Retrieved ${issueList.length} Issues`);
          return issueList;
        });
    }

    return config.issueList;
  },

  async findIssue(title: string): Promise<Issue> {
    const issueList = await platform.getIssueList();
    const issue = issueList.find(
      (i) => i.state === 'open' && i.title === title
    );

    if (issue) {
      logger.debug(`Found Issue #${issue.number}`);
    }
    return issue ?? null;
  },

  async ensureIssue({
    title,
    reuseTitle,
    body: content,
    shouldReOpen,
    once,
  }: EnsureIssueConfig): Promise<'updated' | 'created' | null> {
    logger.debug(`ensureIssue(${title})`);
    try {
      const body = smartLinks(content);

      const issueList = await platform.getIssueList();
      let issues = issueList.filter((i) => i.title === title);
      if (!issues.length) {
        issues = issueList.filter((i) => i.title === reuseTitle);
      }
      // Update any matching issues which currently exist
      if (issues.length) {
        let activeIssue = issues.find((i) => i.state === 'open');

        // If no active issue was found, decide if it shall be skipped, re-opened or updated without state change
        if (!activeIssue) {
          if (once) {
            logger.debug('Issue already closed - skipping update');
            return null;
          }
          if (shouldReOpen) {
            logger.debug('Reopening previously closed Issue');
          }

          // Pick the last issue in the list as the active one
          activeIssue = issues[issues.length - 1];
        }

        // Close any duplicate issues
        for (const issue of issues) {
          if (issue.state === 'open' && issue.number !== activeIssue.number) {
            logger.warn(`Closing duplicate Issue #${issue.number}`);
            await helper.closeIssue(config.repository, issue.number);
          }
        }

        // Check if issue has already correct state
        if (
          activeIssue.title === title &&
          activeIssue.body === body &&
          activeIssue.state === 'open'
        ) {
          logger.debug(
            `Issue #${activeIssue.number} is open and up to date - nothing to do`
          );
          return null;
        }

        // Update issue body and re-open if enabled
        logger.debug(`Updating Issue #${activeIssue.number}`);
        await helper.updateIssue(config.repository, activeIssue.number, {
          body,
          title,
          state: shouldReOpen
            ? 'open'
            : (activeIssue.state as helper.IssueState),
        });

        return 'updated';
      }

      // Create new issue and reset cache
      const issue = await helper.createIssue(config.repository, {
        body,
        title,
      });
      logger.debug(`Created new Issue #${issue.number}`);
      config.issueList = null;

      return 'created';
    } catch (err) {
      logger.warn({ err }, 'Could not ensure issue');
    }

    return null;
  },

  async ensureIssueClosing(title: string): Promise<void> {
    logger.debug(`ensureIssueClosing(${title})`);
    const issueList = await platform.getIssueList();
    for (const issue of issueList) {
      if (issue.state === 'open' && issue.title === title) {
        logger.debug({ number: issue.number }, 'Closing issue');
        await helper.closeIssue(config.repository, issue.number);
      }
    }
  },

  async deleteLabel(issue: number, labelName: string): Promise<void> {
    logger.debug(`Deleting label ${labelName} from Issue #${issue}`);
    const label = await lookupLabelByName(labelName);
    if (label) {
      await helper.unassignLabel(config.repository, issue, label);
    } else {
      logger.warn({ issue, labelName }, 'Failed to lookup label for deletion');
    }

    return null;
  },

  getRepoForceRebase(): Promise<boolean> {
    return Promise.resolve(false);
  },

  async ensureComment({
    number: issue,
    topic,
    content,
  }: EnsureCommentConfig): Promise<boolean> {
    try {
      let body = sanitize(content);
      const commentList = await helper.getComments(config.repository, issue);

      // Search comment by either topic or exact body
      let comment: helper.Comment = null;
      if (topic) {
        comment = findCommentByTopic(commentList, topic);
        body = `### ${topic}\n\n${body}`;
      } else {
        comment = commentList.find((c) => c.body === body);
      }

      // Create a new comment if no match has been found, otherwise update if necessary
      if (!comment) {
        const c = await helper.createComment(config.repository, issue, body);
        logger.info(
          { repository: config.repository, issue, comment: c.id },
          'Comment added'
        );
      } else if (comment.body === body) {
        logger.debug(`Comment #${comment.id} is already up-to-date`);
      } else {
        const c = await helper.updateComment(config.repository, issue, body);
        logger.debug(
          { repository: config.repository, issue, comment: c.id },
          'Comment updated'
        );
      }

      return true;
    } catch (err) {
      logger.warn({ err }, 'Error ensuring comment');
      return false;
    }
  },

  async ensureCommentRemoval({
    number: issue,
    topic,
    content,
  }: EnsureCommentRemovalConfig): Promise<void> {
    logger.debug(
      `Ensuring comment "${topic || content}" in #${issue} is removed`
    );
    const commentList = await helper.getComments(config.repository, issue);
    let comment: helper.Comment | null = null;

    if (topic) {
      comment = findCommentByTopic(commentList, topic);
    } else if (content) {
      comment = findCommentByContent(commentList, content);
    }

    // Abort and do nothing if no matching comment was found
    if (!comment) {
      return;
    }

    // Attempt to delete comment
    try {
      await helper.deleteComment(config.repository, comment.id);
    } catch (err) {
      logger.warn({ err, issue, subject: topic }, 'Error deleting comment');
    }
  },

  async getBranchPr(branchName: string): Promise<Pr | null> {
    logger.debug(`getBranchPr(${branchName})`);
    const pr = await platform.findPr({ branchName, state: PrState.Open });
    return pr ? platform.getPr(pr.number) : null;
  },

  async addAssignees(number: number, assignees: string[]): Promise<void> {
    logger.debug(
      `Updating assignees '${assignees?.join(', ')}' on Issue #${number}`
    );
    await helper.updateIssue(config.repository, number, {
      assignees,
    });
  },

  async addReviewers(number: number, reviewers: string[]): Promise<void> {
    logger.debug(`Adding reviewers '${reviewers?.join(', ')}' to #${number}`);
    if (lt(defaults.version, '1.14.0')) {
      logger.debug(
        { version: defaults.version },
        'Adding reviewer not yet supported.'
      );
      return;
    }
    try {
      await helper.requestPrReviewers(config.repository, number, { reviewers });
    } catch (err) {
      logger.warn({ err, number, reviewers }, 'Failed to assign reviewer');
    }
  },

  massageMarkdown(prBody: string): string {
    return smartTruncate(smartLinks(prBody), 1000000);
  },

  getVulnerabilityAlerts(): Promise<VulnerabilityAlert[]> {
    return Promise.resolve([]);
  },
};

// eslint-disable-next-line @typescript-eslint/unbound-method
export const {
  addAssignees,
  addReviewers,
  createPr,
  deleteLabel,
  ensureComment,
  ensureCommentRemoval,
  ensureIssue,
  ensureIssueClosing,
  findIssue,
  findPr,
  getBranchPr,
  getBranchStatus,
  getBranchStatusCheck,
  getRawFile,
  getJsonFile,
  getIssueList,
  getPr,
  massageMarkdown,
  getPrList,
  getRepoForceRebase,
  getRepos,
  getVulnerabilityAlerts,
  initPlatform,
  initRepo,
  mergePr,
  setBranchStatus,
  updatePr,
} = platform;
