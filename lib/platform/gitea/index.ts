import URL from 'url';
import GitStorage, { StatusResult } from '../git/storage';
import * as hostRules from '../../util/host-rules';
import {
  BranchStatusConfig,
  CreatePRConfig,
  EnsureCommentConfig,
  EnsureIssueConfig,
  FindPRConfig,
  Issue,
  Platform,
  PlatformConfig,
  Pr,
  RepoConfig,
  RepoParams,
  VulnerabilityAlert,
  CommitFilesConfig,
} from '../common';
import { api } from './gitea-got-wrapper';
import { PLATFORM_TYPE_GITEA } from '../../constants/platforms';
import { logger } from '../../logger';
import {
  REPOSITORY_ACCESS_FORBIDDEN,
  REPOSITORY_ARCHIVED,
  REPOSITORY_BLOCKED,
  REPOSITORY_CHANGED,
  REPOSITORY_DISABLED,
  REPOSITORY_EMPTY,
  REPOSITORY_MIRRORED,
} from '../../constants/error-messages';
import { RenovateConfig } from '../../config/common';
import { configFileNames } from '../../config/app-strings';
import { smartTruncate } from '../utils/pr-body';
import { sanitize } from '../../util/sanitize';
import { BranchStatus } from '../../types';
import * as helper from './gitea-helper';
import { PR_STATE_ALL, PR_STATE_OPEN } from '../../constants/pull-requests';

type GiteaRenovateConfig = {
  endpoint: string;
  token: string;
} & RenovateConfig;

interface GiteaRepoConfig {
  storage: GitStorage;
  repository: string;
  localDir: string;
  defaultBranch: string;
  baseBranch: string;
  mergeMethod: helper.PRMergeMethod;

  prList: Promise<Pr[]> | null;
  issueList: Promise<Issue[]> | null;
  labelList: Promise<helper.Label[]> | null;
}

const defaults: any = {
  hostType: PLATFORM_TYPE_GITEA,
  endpoint: 'https://gitea.com/api/v1/',
};
const defaultConfigFile = configFileNames[0];

let config: GiteaRepoConfig = {} as any;
let botUserID: number;

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
    !data.head?.ref ||
    !data.head?.sha ||
    !data.head?.repo?.full_name
  ) {
    logger.trace(
      `Skipping Pull Request #${data.number} due to missing base and/or head branch`
    );
    return null;
  }

  return {
    number: data.number,
    displayNumber: `Pull Request #${data.number}`,
    state: data.state,
    title: data.title,
    body: data.body,
    sha: data.head.sha,
    branchName: data.head.ref,
    targetBranch: data.base.ref,
    sourceRepo: data.head.repo.full_name,
    createdAt: data.created_at,
    closedAt: data.closed_at,
    canMerge: data.mergeable,
    isConflicted: !data.mergeable,
    isStale: undefined,
    isModified: undefined,
  };
}

function matchesState(actual: string, expected: string): boolean {
  if (expected === PR_STATE_ALL) {
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
  return comments.find(c => c.body.startsWith(`### ${topic}\n\n`));
}

async function isPRModified(
  repoPath: string,
  branchName: string
): Promise<boolean> {
  try {
    const branch = await helper.getBranch(repoPath, branchName);
    const branchCommitEmail = branch.commit.author.email;
    const configEmail = global.gitAuthor.email;

    if (branchCommitEmail === configEmail) {
      return false;
    }

    logger.debug(
      { branchCommitEmail, configEmail },
      'Last committer to branch does not match bot, PR cannot be rebased'
    );
    return true;
  } catch (err) {
    logger.warn({ err }, 'Error getting PR branch, marking as modified');
    return true;
  }
}

async function retrieveDefaultConfig(
  repoPath: string,
  branchName: string
): Promise<RenovateConfig> {
  const contents = await helper.getRepoContents(
    repoPath,
    defaultConfigFile,
    branchName
  );

  return JSON.parse(contents.contentString);
}

function getLabelList(): Promise<helper.Label[]> {
  if (config.labelList === null) {
    config.labelList = helper
      .getRepoLabels(config.repository, {
        useCache: false,
      })
      .then(labels => {
        logger.debug(`Retrieved ${labels.length} Labels`);
        return labels;
      });
  }

  return config.labelList;
}

async function lookupLabelByName(name: string): Promise<number | null> {
  logger.debug(`lookupLabelByName(${name})`);
  const labelList = await getLabelList();
  return labelList.find(l => l.name === name)?.id;
}

const platform: Platform = {
  async initPlatform({
    endpoint,
    token,
  }: GiteaRenovateConfig): Promise<PlatformConfig> {
    if (!token) {
      throw new Error('Init: You must configure a Gitea personal access token');
    }

    if (endpoint) {
      // Ensure endpoint contains trailing slash
      defaults.endpoint = endpoint.replace(/\/?$/, '/');
    } else {
      logger.debug('Using default Gitea endpoint: ' + defaults.endpoint);
    }
    api.setBaseUrl(defaults.endpoint);

    let gitAuthor: string;
    try {
      const user = await helper.getCurrentUser({ token });
      gitAuthor = `${user.full_name || user.username} <${user.email}>`;
      botUserID = user.id;
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

  async initRepo({
    repository,
    localDir,
    optimizeForDisabled,
  }: RepoParams): Promise<RepoConfig> {
    let renovateConfig: RenovateConfig;
    let repo: helper.Repo;

    config = {} as any;
    config.repository = repository;
    config.localDir = localDir;

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
    config.baseBranch = config.defaultBranch;
    logger.debug(`${repository} default branch = ${config.baseBranch}`);

    // Optionally check if Renovate is disabled by attempting to fetch default configuration file
    if (optimizeForDisabled) {
      try {
        renovateConfig = await retrieveDefaultConfig(
          config.repository,
          config.defaultBranch
        );
      } catch (err) {
        // Do nothing
      }

      if (renovateConfig && renovateConfig.enabled === false) {
        throw new Error(REPOSITORY_DISABLED);
      }
    }

    // Find options for current host and determine Git endpoint
    const opts = hostRules.find({
      hostType: PLATFORM_TYPE_GITEA,
      url: defaults.endpoint,
    });
    const gitEndpoint = URL.parse(repo.clone_url);
    gitEndpoint.auth = opts.token;

    // Initialize Git storage
    config.storage = new GitStorage();
    await config.storage.initRepo({
      ...config,
      url: URL.format(gitEndpoint),
    });

    // Reset cached resources
    config.prList = null;
    config.issueList = null;
    config.labelList = null;

    return {
      baseBranch: config.baseBranch,
      isFork: !!repo.fork,
    };
  },

  async getRepos(): Promise<string[]> {
    logger.debug('Auto-discovering Gitea repositories');
    try {
      const repos = await helper.searchRepos({ uid: botUserID });
      return repos.map(r => r.full_name);
    } catch (err) {
      logger.error({ err }, 'Gitea getRepos() error');
      throw err;
    }
  },

  cleanRepo(): Promise<void> {
    if (config.storage) {
      config.storage.cleanRepo();
    }
    config = {} as any;
    return Promise.resolve();
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
      const branchCommit = await config.storage.getBranchCommit(branchName);
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
    const cs = ccs.statuses.find(s => s.context === context);
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

  async setBaseBranch(
    baseBranch: string = config.defaultBranch
  ): Promise<void> {
    config.baseBranch = baseBranch;
    await config.storage.setBaseBranch(baseBranch);
  },

  getPrList(): Promise<Pr[]> {
    if (config.prList === null) {
      config.prList = helper
        .searchPRs(config.repository, {}, { useCache: false })
        .then(prs => {
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
    let pr = prList.find(p => p.number === number);
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

    // Enrich pull request with additional information which is more expensive to fetch
    if (pr.isStale === undefined) {
      pr.isStale = await platform.isBranchStale(pr.branchName);
    }
    if (pr.isModified === undefined) {
      pr.isModified = await isPRModified(config.repository, pr.branchName);
    }

    return pr;
  },

  async findPr({
    branchName,
    prTitle: title,
    state = PR_STATE_ALL,
  }: FindPRConfig): Promise<Pr> {
    logger.debug(`findPr(${branchName}, ${title}, ${state})`);
    const prList = await platform.getPrList();
    const pr = prList.find(
      p =>
        p.sourceRepo === config.repository &&
        p.branchName === branchName &&
        matchesState(p.state, state) &&
        (!title || p.title === title)
    );

    if (pr) {
      logger.debug(`Found PR #${pr.number}`);
    }
    return pr ?? null;
  },

  async createPr({
    branchName,
    prTitle: title,
    prBody: rawBody,
    labels: labelNames,
    useDefaultBranch,
  }: CreatePRConfig): Promise<Pr> {
    const base = useDefaultBranch ? config.defaultBranch : config.baseBranch;
    const head = branchName;
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
          `Attempting to gracefully recover from 409 Conflict response in createPr(${title}, ${branchName})`
        );

        // Refresh cached PR list and search for pull request with matching information
        config.prList = null;
        const pr = await platform.findPr({
          branchName,
          state: PR_STATE_OPEN,
        });

        // If a valid PR was found, return and gracefully recover from the error. Otherwise, abort and throw error.
        if (pr) {
          if (pr.title !== title || pr.body !== body) {
            logger.debug(
              `Recovered from 409 Conflict, but PR for ${branchName} is outdated. Updating...`
            );
            await platform.updatePr(pr.number, title, body);
            pr.title = title;
            pr.body = body;
          } else {
            logger.debug(
              `Recovered from 409 Conflict and PR for ${branchName} is up-to-date`
            );
          }

          return pr;
        }
      }

      throw err;
    }
  },

  async updatePr(number: number, title: string, body?: string): Promise<void> {
    await helper.updatePR(config.repository, number, {
      title,
      ...(body && { body }),
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

  async getPrFiles(prNo: number): Promise<string[]> {
    if (!prNo) {
      return [];
    }

    // Retrieving a diff for a PR is not officially supported by Gitea as of today
    // See tracking issue: https://github.com/go-gitea/gitea/issues/5561
    // Workaround: Parse new paths in .diff file using regular expressions
    const regex = /^diff --git a\/.+ b\/(.+)$/gm;
    const pr = await helper.getPR(config.repository, prNo);
    const diff = (await api.get(pr.diff_url)).body as string;

    const changedFiles: string[] = [];
    let match: string[];
    do {
      match = regex.exec(diff);
      if (match) {
        changedFiles.push(match[1]);
      }
    } while (match);

    return changedFiles;
  },

  getIssueList(): Promise<Issue[]> {
    if (config.issueList === null) {
      config.issueList = helper
        .searchIssues(config.repository, {}, { useCache: false })
        .then(issues => {
          const issueList = issues.map(toRenovateIssue);
          logger.debug(`Retrieved ${issueList.length} Issues`);
          return issueList;
        });
    }

    return config.issueList;
  },

  async findIssue(title: string): Promise<Issue> {
    const issueList = await platform.getIssueList();
    const issue = issueList.find(i => i.state === 'open' && i.title === title);

    if (issue) {
      logger.debug(`Found Issue #${issue.number}`);
    }
    return issue ?? null;
  },

  async ensureIssue({
    title,
    body,
    shouldReOpen,
    once,
  }: EnsureIssueConfig): Promise<'updated' | 'created' | null> {
    logger.debug(`ensureIssue(${title})`);
    try {
      const issueList = await platform.getIssueList();
      const issues = issueList.filter(i => i.title === title);

      // Update any matching issues which currently exist
      if (issues.length) {
        let activeIssue = issues.find(i => i.state === 'open');

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
        if (activeIssue.body === body && activeIssue.state === 'open') {
          logger.debug(
            `Issue #${activeIssue.number} is open and up to date - nothing to do`
          );
          return null;
        }

        // Update issue body and re-open if enabled
        logger.debug(`Updating Issue #${activeIssue.number}`);
        await helper.updateIssue(config.repository, activeIssue.number, {
          body,
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
    if (topic === 'Renovate Ignore Notification') {
      logger.debug(
        `Skipping ensureComment(${topic}) as ignoring PRs is unsupported on Gitea.`
      );
      return false;
    }

    try {
      let body = sanitize(content);
      const commentList = await helper.getComments(config.repository, issue);

      // Search comment by either topic or exact body
      let comment: helper.Comment = null;
      if (topic) {
        comment = findCommentByTopic(commentList, topic);
        body = `### ${topic}\n\n${body}`;
      } else {
        comment = commentList.find(c => c.body === body);
      }

      // Create a new comment if no match has been found, otherwise update if necessary
      if (!comment) {
        const c = await helper.createComment(config.repository, issue, body);
        logger.info(
          { repository: config.repository, issue, comment: c.id },
          'Comment added'
        );
      } else if (comment.body !== body) {
        const c = await helper.updateComment(config.repository, issue, body);
        logger.debug(
          { repository: config.repository, issue, comment: c.id },
          'Comment updated'
        );
      } else {
        logger.debug(`Comment #${comment.id} is already up-to-date`);
      }

      return true;
    } catch (err) {
      logger.warn({ err }, 'Error ensuring comment');
      return false;
    }
  },

  async ensureCommentRemoval(issue: number, topic: string): Promise<void> {
    const commentList = await helper.getComments(config.repository, issue);
    const comment = findCommentByTopic(commentList, topic);

    // Abort and do nothing if no matching comment was found
    if (!comment) {
      return null;
    }

    // Attempt to delete comment
    try {
      await helper.deleteComment(config.repository, comment.id);
    } catch (err) {
      logger.warn({ err, issue, subject: topic }, 'Error deleting comment');
    }

    return null;
  },

  async getBranchPr(branchName: string): Promise<Pr | null> {
    logger.debug(`getBranchPr(${branchName})`);
    const pr = await platform.findPr({ branchName, state: PR_STATE_OPEN });
    return pr ? platform.getPr(pr.number) : null;
  },

  async deleteBranch(branchName: string, closePr?: boolean): Promise<void> {
    logger.debug(`deleteBranch(${branchName})`);
    if (closePr) {
      const pr = await platform.getBranchPr(branchName);
      if (pr) {
        await helper.closePR(config.repository, pr.number);
      }
    }

    return config.storage.deleteBranch(branchName);
  },

  async addAssignees(number: number, assignees: string[]): Promise<void> {
    logger.debug(`Updating assignees ${assignees} on Issue #${number}`);
    await helper.updateIssue(config.repository, number, {
      assignees,
    });
  },

  addReviewers(number: number, reviewers: string[]): Promise<void> {
    // Adding reviewers to a PR through API is not supported by Gitea as of today
    // See tracking issue: https://github.com/go-gitea/gitea/issues/5733
    logger.debug(`Updating reviewers ${reviewers} on Pull Request #${number}`);
    logger.warn('Unimplemented in Gitea: Reviewers');
    return Promise.resolve();
  },

  commitFilesToBranch({
    branchName,
    files,
    message,
    parentBranch = config.baseBranch,
  }: CommitFilesConfig): Promise<string | null> {
    return config.storage.commitFilesToBranch({
      branchName,
      files,
      message,
      parentBranch,
    });
  },

  getPrBody(prBody: string): string {
    // Gitea does not preserve the branch name once the head branch gets deleted, so ignoring a PR by simply closing it
    // results in an endless loop of Renovate creating the PR over and over again. This is not pretty, but can not be
    // avoided without storing that information somewhere else, so at least warn the user about it.
    return smartTruncate(
      prBody.replace(
        /:no_bell: \*\*Ignore\*\*: Close this PR and you won't be reminded about (this update|these updates) again./,
        `:ghost: **Immortal**: This PR will be recreated if closed unmerged, as Gitea does not support ignoring PRs.`
      ),
      1000000
    );
  },

  isBranchStale(branchName: string): Promise<boolean> {
    return config.storage.isBranchStale(branchName);
  },

  setBranchPrefix(branchPrefix: string): Promise<void> {
    return config.storage.setBranchPrefix(branchPrefix);
  },

  branchExists(branchName: string): Promise<boolean> {
    return config.storage.branchExists(branchName);
  },

  mergeBranch(branchName: string): Promise<void> {
    return config.storage.mergeBranch(branchName);
  },

  getBranchLastCommitTime(branchName: string): Promise<Date> {
    return config.storage.getBranchLastCommitTime(branchName);
  },

  getFile(lockFileName: string, branchName?: string): Promise<string> {
    return config.storage.getFile(lockFileName, branchName);
  },

  getRepoStatus(): Promise<StatusResult> {
    return config.storage.getRepoStatus();
  },

  getFileList(): Promise<string[]> {
    return config.storage.getFileList(config.baseBranch);
  },

  getAllRenovateBranches(branchPrefix: string): Promise<string[]> {
    return config.storage.getAllRenovateBranches(branchPrefix);
  },

  getCommitMessages(): Promise<string[]> {
    return config.storage.getCommitMessages();
  },

  getVulnerabilityAlerts(): Promise<VulnerabilityAlert[]> {
    return Promise.resolve([]);
  },
};

export const {
  addAssignees,
  addReviewers,
  branchExists,
  cleanRepo,
  commitFilesToBranch,
  createPr,
  deleteBranch,
  deleteLabel,
  ensureComment,
  ensureCommentRemoval,
  ensureIssue,
  ensureIssueClosing,
  findIssue,
  findPr,
  getAllRenovateBranches,
  getBranchLastCommitTime,
  getBranchPr,
  getBranchStatus,
  getBranchStatusCheck,
  getCommitMessages,
  getFile,
  getFileList,
  getIssueList,
  getPr,
  getPrBody,
  getPrFiles,
  getPrList,
  getRepoForceRebase,
  getRepoStatus,
  getRepos,
  getVulnerabilityAlerts,
  initPlatform,
  initRepo,
  isBranchStale,
  mergeBranch,
  mergePr,
  setBaseBranch,
  setBranchPrefix,
  setBranchStatus,
  updatePr,
} = platform;
