import parseDiff from 'parse-diff';
import addrs from 'email-addresses';
import { api } from './bb-got-wrapper';
import * as utils from './utils';
import * as hostRules from '../../util/host-rules';
import { logger } from '../../logger';
import GitStorage, { StatusResult, CommitFilesConfig } from '../git/storage';
import { readOnlyIssueBody } from '../utils/read-only-issue-body';
import * as comments from './comments';
import {
  PlatformConfig,
  RepoParams,
  RepoConfig,
  Pr,
  Issue,
  VulnerabilityAlert,
  CreatePRConfig,
  EnsureIssueConfig,
  BranchStatusConfig,
} from '../common';
import { sanitize } from '../../util/sanitize';
import { smartTruncate } from '../utils/pr-body';
import {
  REPOSITORY_DISABLED,
  REPOSITORY_NOT_FOUND,
} from '../../constants/error-messages';

let config: utils.Config = {} as any;

export function initPlatform({
  endpoint,
  username,
  password,
}: {
  endpoint?: string;
  username: string;
  password: string;
}): PlatformConfig {
  if (!(username && password)) {
    throw new Error(
      'Init: You must configure a Bitbucket username and password'
    );
  }
  if (endpoint && endpoint !== 'https://api.bitbucket.org/') {
    throw new Error(
      'Init: Bitbucket Cloud endpoint can only be https://api.bitbucket.org/'
    );
  }
  // TODO: Add a connection check that endpoint/username/password combination are valid
  const platformConfig: PlatformConfig = {
    endpoint: 'https://api.bitbucket.org/',
  };
  return platformConfig;
}

// Get all repositories that the user has access to
export async function getRepos(): Promise<string[]> {
  logger.info('Autodiscovering Bitbucket Cloud repositories');
  try {
    const repos = await utils.accumulateValues<{ full_name: string }>(
      `/2.0/repositories/?role=contributor`
    );
    return repos.map(repo => repo.full_name);
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, `bitbucket getRepos error`);
    throw err;
  }
}

// Initialize bitbucket by getting base branch and SHA
export async function initRepo({
  repository,
  localDir,
  optimizeForDisabled,
  bbUseDefaultReviewers,
}: RepoParams): Promise<RepoConfig> {
  logger.debug(`initRepo("${repository}")`);
  const opts = hostRules.find({
    hostType: 'bitbucket',
    url: 'https://api.bitbucket.org/',
  });
  config = {
    repository,
    username: opts!.username,
    bbUseDefaultReviewers: bbUseDefaultReviewers !== false,
  } as any;
  let info: utils.RepoInfo;
  try {
    info = utils.repoInfoTransformer(
      (await api.get(`/2.0/repositories/${repository}`)).body
    );

    if (optimizeForDisabled) {
      interface RenovateConfig {
        enabled: boolean;
      }

      let renovateConfig: RenovateConfig;
      try {
        renovateConfig = (await api.get<RenovateConfig>(
          `/2.0/repositories/${repository}/src/${info.mainbranch}/renovate.json`
        )).body;
      } catch {
        // Do nothing
      }
      if (renovateConfig && renovateConfig.enabled === false) {
        throw new Error(REPOSITORY_DISABLED);
      }
    }

    Object.assign(config, {
      owner: info.owner,
      defaultBranch: info.mainbranch,
      baseBranch: info.mainbranch,
      mergeMethod: info.mergeMethod,
      has_issues: info.has_issues,
    });

    logger.debug(`${repository} owner = ${config.owner}`);
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 404) {
      throw new Error(REPOSITORY_NOT_FOUND);
    }
    logger.info({ err }, 'Unknown Bitbucket initRepo error');
    throw err;
  }

  const url = GitStorage.getUrl({
    protocol: 'https',
    auth: `${opts!.username}:${opts!.password}`,
    hostname: 'bitbucket.org',
    repository,
  });

  config.storage = new GitStorage();
  await config.storage.initRepo({
    ...config,
    localDir,
    url,
  });
  const repoConfig: RepoConfig = {
    baseBranch: config.baseBranch,
    isFork: info.isFork,
  };
  return repoConfig;
}

// Returns true if repository has rule enforcing PRs are up-to-date with base branch before merging
export function getRepoForceRebase(): boolean {
  // BB doesnt have an option to flag staled branches
  return false;
}

// Search

// Get full file list
export function getFileList(branchName?: string): Promise<string[]> {
  return config.storage.getFileList(branchName);
}

export async function setBaseBranch(
  branchName = config.baseBranch
): Promise<void> {
  logger.debug(`Setting baseBranch to ${branchName}`);
  config.baseBranch = branchName;
  delete config.baseCommitSHA;
  delete config.fileList;
  await config.storage.setBaseBranch(branchName);
  await getFileList(branchName);
}

export /* istanbul ignore next */ function setBranchPrefix(
  branchPrefix: string
): Promise<void> {
  return config.storage.setBranchPrefix(branchPrefix);
}

// Branch

// Returns true if branch exists, otherwise false
export function branchExists(branchName: string): Promise<boolean> {
  return config.storage.branchExists(branchName);
}

export function getAllRenovateBranches(
  branchPrefix: string
): Promise<string[]> {
  return config.storage.getAllRenovateBranches(branchPrefix);
}

export function isBranchStale(branchName: string): Promise<boolean> {
  return config.storage.isBranchStale(branchName);
}

export function getFile(
  filePath: string,
  branchName?: string
): Promise<string> {
  return config.storage.getFile(filePath, branchName);
}

// istanbul ignore next
function matchesState(state: string, desiredState: string): boolean {
  if (desiredState === 'all') {
    return true;
  }
  if (desiredState[0] === '!') {
    return state !== desiredState.substring(1);
  }
  return state === desiredState;
}

export async function getPrList(): Promise<Pr[]> {
  logger.debug('getPrList()');
  if (!config.prList) {
    logger.debug('Retrieving PR list');
    let url = `/2.0/repositories/${config.repository}/pullrequests?`;
    url += utils.prStates.all.map(state => 'state=' + state).join('&');
    const prs = await utils.accumulateValues(url, undefined, undefined, 50);
    config.prList = prs.map(utils.prInfo);
    logger.info({ length: config.prList.length }, 'Retrieved Pull Requests');
  }
  return config.prList;
}

export async function findPr(
  branchName: string,
  prTitle?: string | null,
  state = 'all'
): Promise<Pr | null> {
  logger.debug(`findPr(${branchName}, ${prTitle}, ${state})`);
  const prList = await getPrList();
  const pr = prList.find(
    p =>
      p.branchName === branchName &&
      (!prTitle || p.title === prTitle) &&
      matchesState(p.state, state)
  );
  if (pr) {
    logger.debug(`Found PR #${pr.number}`);
  }
  return pr;
}

export async function deleteBranch(
  branchName: string,
  closePr?: boolean
): Promise<void> {
  if (closePr) {
    const pr = await findPr(branchName, null, 'open');
    if (pr) {
      await api.post(
        `/2.0/repositories/${config.repository}/pullrequests/${pr.number}/decline`
      );
    }
  }
  return config.storage.deleteBranch(branchName);
}

export function getBranchLastCommitTime(branchName: string): Promise<Date> {
  return config.storage.getBranchLastCommitTime(branchName);
}

// istanbul ignore next
export function getRepoStatus(): Promise<StatusResult> {
  return config.storage.getRepoStatus();
}

export function mergeBranch(branchName: string): Promise<void> {
  return config.storage.mergeBranch(branchName);
}

export function commitFilesToBranch({
  branchName,
  files,
  message,
  parentBranch = config.baseBranch,
}: CommitFilesConfig): Promise<void> {
  return config.storage.commitFilesToBranch({
    branchName,
    files,
    message,
    parentBranch,
  });
}

export function getCommitMessages(): Promise<string[]> {
  return config.storage.getCommitMessages();
}

async function isPrConflicted(prNo: number): Promise<boolean> {
  const diff = (await api.get(
    `/2.0/repositories/${config.repository}/pullrequests/${prNo}/diff`,
    { json: false } as any
  )).body;

  return utils.isConflicted(parseDiff(diff));
}

// Gets details for a PR
export async function getPr(prNo: number): Promise<Pr | null> {
  const pr = (await api.get(
    `/2.0/repositories/${config.repository}/pullrequests/${prNo}`
  )).body;

  // istanbul ignore if
  if (!pr) {
    return null;
  }

  const res: any = {
    displayNumber: `Pull Request #${pr.id}`,
    ...utils.prInfo(pr),
    isModified: false,
  };

  if (utils.prStates.open.includes(pr.state)) {
    res.isConflicted = await isPrConflicted(prNo);

    // TODO: Is that correct? Should we check getBranchStatus like gitlab?
    res.canMerge = !res.isConflicted;

    // we only want the first two commits, because size tells us the overall number
    const url = pr.links.commits.href + '?pagelen=2';
    const { body } = await api.get<utils.PagedResult<Commit>>(url);
    const size = body.size || body.values.length;

    // istanbul ignore if
    if (size === undefined) {
      logger.warn({ prNo, url, body }, 'invalid response so can rebase');
    } else if (size === 1) {
      if (global.gitAuthor) {
        const author = addrs.parseOneAddress(
          body.values[0].author.raw
        ) as addrs.ParsedMailbox;
        if (author.address !== global.gitAuthor.email) {
          logger.debug(
            { prNo },
            'PR is modified: 1 commit but not by configured gitAuthor'
          );
          res.isModified = true;
        }
      }
    } else {
      logger.debug({ prNo }, `PR is modified: Found ${size} commits`);
      res.isModified = true;
    }
  }
  if (await branchExists(pr.source.branch.name)) {
    res.isStale = await isBranchStale(pr.source.branch.name);
  }

  return res;
}

const escapeHash = (input: string): string =>
  input ? input.replace(/#/g, '%23') : input;

// Return the commit SHA for a branch
async function getBranchCommit(branchName: string): Promise<string | null> {
  try {
    const branch = (await api.get(
      `/2.0/repositories/${config.repository}/refs/branches/${escapeHash(
        branchName
      )}`
    )).body;
    return branch.target.hash;
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err }, `getBranchCommit('${branchName}') failed'`);
    return null;
  }
}

// Returns the Pull Request for a branch. Null if not exists.
export async function getBranchPr(branchName: string): Promise<Pr | null> {
  logger.debug(`getBranchPr(${branchName})`);
  const existingPr = await findPr(branchName, null, 'open');
  return existingPr ? getPr(existingPr.number) : null;
}

async function getStatus(
  branchName: string,
  useCache = true
): Promise<utils.BitbucketStatus[]> {
  const sha = await getBranchCommit(branchName);
  return utils.accumulateValues<utils.BitbucketStatus>(
    `/2.0/repositories/${config.repository}/commit/${sha}/statuses`,
    'get',
    { useCache }
  );
}
// Returns the combined status for a branch.
export async function getBranchStatus(
  branchName: string,
  requiredStatusChecks?: string[]
): Promise<string> {
  logger.debug(`getBranchStatus(${branchName})`);
  if (!requiredStatusChecks) {
    // null means disable status checks, so it always succeeds
    logger.debug('Status checks disabled = returning "success"');
    return 'success';
  }
  if (requiredStatusChecks.length) {
    // This is Unsupported
    logger.warn({ requiredStatusChecks }, `Unsupported requiredStatusChecks`);
    return 'failed';
  }
  const statuses = await getStatus(branchName);
  logger.debug({ branch: branchName, statuses }, 'branch status check result');
  if (!statuses.length) {
    logger.debug('empty branch status check result = returning "pending"');
    return 'pending';
  }
  const noOfFailures = statuses.filter(
    (status: { state: string }) => status.state === 'FAILED'
  ).length;
  if (noOfFailures) {
    return 'failed';
  }
  const noOfPending = statuses.filter(
    (status: { state: string }) => status.state === 'INPROGRESS'
  ).length;
  if (noOfPending) {
    return 'pending';
  }
  return 'success';
}

export async function getBranchStatusCheck(
  branchName: string,
  context: string
): Promise<string | null> {
  const statuses = await getStatus(branchName);
  const bbState = (statuses.find(status => status.key === context) || {}).state;

  return (
    Object.keys(utils.buildStates).find(
      stateKey => utils.buildStates[stateKey] === bbState
    ) || null
  );
}

export async function setBranchStatus({
  branchName,
  context,
  description,
  state,
  url: targetUrl,
}: BranchStatusConfig): Promise<void> {
  const sha = await getBranchCommit(branchName);

  // TargetUrl can not be empty so default to bitbucket
  const url = targetUrl || /* istanbul ignore next */ 'http://bitbucket.org';

  const body = {
    name: context,
    state: utils.buildStates[state],
    key: context,
    description,
    url,
  };

  await api.post(
    `/2.0/repositories/${config.repository}/commit/${sha}/statuses/build`,
    { body }
  );
  // update status cache
  await getStatus(branchName, false);
}

type BbIssue = { id: number; content?: { raw: string } };

async function findOpenIssues(title: string): Promise<BbIssue[]> {
  try {
    const filter = encodeURIComponent(
      [
        `title=${JSON.stringify(title)}`,
        '(state = "new" OR state = "open")',
        `reporter.username="${config.username}"`,
      ].join(' AND ')
    );
    return (
      (await api.get(
        `/2.0/repositories/${config.repository}/issues?q=${filter}`
      )).body.values || /* istanbul ignore next */ []
    );
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error finding issues');
    return [];
  }
}

export async function findIssue(title: string): Promise<Issue> {
  logger.debug(`findIssue(${title})`);

  /* istanbul ignore if */
  if (!config.has_issues) {
    logger.debug('Issues are disabled - cannot findIssue');
    return null;
  }
  const issues = await findOpenIssues(title);
  if (!issues.length) {
    return null;
  }
  const [issue] = issues;
  return {
    number: issue.id,
    body: issue.content && issue.content.raw,
  };
}

async function closeIssue(issueNumber: number): Promise<void> {
  await api.put(
    `/2.0/repositories/${config.repository}/issues/${issueNumber}`,
    {
      body: { state: 'closed' },
    }
  );
}

export function getPrBody(input: string): string {
  // Remove any HTML we use
  return smartTruncate(input, 50000)
    .replace(/<\/?summary>/g, '**')
    .replace(/<\/?details>/g, '')
    .replace(new RegExp(`\n---\n\n.*?<!-- rebase-check -->.*?\n`), '')
    .replace(/\]\(\.\.\/pull\//g, '](../../pull-requests/');
}

export async function ensureIssue({
  title,
  body,
}: EnsureIssueConfig): Promise<string | null> {
  logger.debug(`ensureIssue()`);
  const description = getPrBody(sanitize(body));

  /* istanbul ignore if */
  if (!config.has_issues) {
    logger.warn('Issues are disabled - cannot ensureIssue');
    logger.info({ title }, 'Failed to ensure Issue');
    return null;
  }
  try {
    const issues = await findOpenIssues(title);
    if (issues.length) {
      // Close any duplicates
      for (const issue of issues.slice(1)) {
        await closeIssue(issue.id);
      }
      const [issue] = issues;
      if (String(issue.content.raw).trim() !== description.trim()) {
        logger.info('Issue updated');
        await api.put(
          `/2.0/repositories/${config.repository}/issues/${issue.id}`,
          {
            body: {
              content: {
                raw: readOnlyIssueBody(description),
                markup: 'markdown',
              },
            },
          }
        );
        return 'updated';
      }
    } else {
      logger.info('Issue created');
      await api.post(`/2.0/repositories/${config.repository}/issues`, {
        body: {
          title,
          content: { raw: readOnlyIssueBody(description), markup: 'markdown' },
        },
      });
      return 'created';
    }
  } catch (err) /* istanbul ignore next */ {
    if (err.message.startsWith('Repository has no issue tracker.')) {
      logger.info(
        `Issues are disabled, so could not create issue: ${err.message}`
      );
    } else {
      logger.warn({ err }, 'Could not ensure issue');
    }
  }
  return null;
}

export /* istanbul ignore next */ async function getIssueList(): Promise<
  Issue[]
> {
  logger.debug(`getIssueList()`);

  /* istanbul ignore if */
  if (!config.has_issues) {
    logger.debug('Issues are disabled - cannot getIssueList');
    return [];
  }
  try {
    const filter = encodeURIComponent(
      [
        '(state = "new" OR state = "open")',
        `reporter.username="${config.username}"`,
      ].join(' AND ')
    );
    return (
      (await api.get(
        `/2.0/repositories/${config.repository}/issues?q=${filter}`
      )).body.values || /* istanbul ignore next */ []
    );
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error finding issues');
    return [];
  }
}

export async function ensureIssueClosing(title: string): Promise<void> {
  /* istanbul ignore if */
  if (!config.has_issues) {
    logger.debug('Issues are disabled - cannot ensureIssueClosing');
    return;
  }
  const issues = await findOpenIssues(title);
  for (const issue of issues) {
    await closeIssue(issue.id);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function addAssignees(
  _prNr: number,
  _assignees: string[]
): Promise<void> {
  // Bitbucket supports "participants" and "reviewers" so does not seem to have the concept of "assignee"
  logger.warn('Cannot add assignees');
  return Promise.resolve();
}

export async function addReviewers(
  prId: number,
  reviewers: string[]
): Promise<void> {
  logger.debug(`Adding reviewers ${reviewers} to #${prId}`);

  const { title } = await getPr(prId);

  const body = {
    title,
    reviewers: reviewers.map((username: string) => ({ username })),
  };

  await api.put(`/2.0/repositories/${config.repository}/pullrequests/${prId}`, {
    body,
  });
}

export /* istanbul ignore next */ function deleteLabel(): never {
  throw new Error('deleteLabel not implemented');
}

export function ensureComment(
  prNo: number,
  topic: string | null,
  content: string
): Promise<boolean> {
  // https://developer.atlassian.com/bitbucket/api/2/reference/search?q=pullrequest+comment
  return comments.ensureComment(config, prNo, topic, sanitize(content));
}

export function ensureCommentRemoval(
  prNo: number,
  topic: string
): Promise<void> {
  return comments.ensureCommentRemoval(config, prNo, topic);
}

// Creates PR and returns PR number
export async function createPr({
  branchName,
  prTitle: title,
  prBody: description,
  useDefaultBranch = true,
}: CreatePRConfig): Promise<Pr> {
  // labels is not supported in Bitbucket: https://bitbucket.org/site/master/issues/11976/ability-to-add-labels-to-pull-requests-bb

  const base = useDefaultBranch
    ? config.defaultBranch
    : /* istanbul ignore next */ config.baseBranch;

  logger.debug({ repository: config.repository, title, base }, 'Creating PR');

  let reviewers = [];

  if (config.bbUseDefaultReviewers) {
    const reviewersResponse = (await api.get<utils.PagedResult<Reviewer>>(
      `/2.0/repositories/${config.repository}/default-reviewers`
    )).body;
    reviewers = reviewersResponse.values.map((reviewer: Reviewer) => ({
      uuid: reviewer.uuid,
    }));
  }

  const body = {
    title,
    description: sanitize(description),
    source: {
      branch: {
        name: branchName,
      },
    },
    destination: {
      branch: {
        name: base,
      },
    },
    close_source_branch: true,
    reviewers,
  };

  const prInfo = (await api.post(
    `/2.0/repositories/${config.repository}/pullrequests`,
    { body }
  )).body;
  // TODO: fix types
  const pr: Pr = {
    number: prInfo.id,
    displayNumber: `Pull Request #${prInfo.id}`,
    isModified: false,
  } as any;
  // istanbul ignore if
  if (config.prList) {
    config.prList.push(pr);
  }
  return pr;
}

interface Reviewer {
  uuid: { raw: string };
}

interface Commit {
  author: { raw: string };
}

// Return a list of all modified files in a PR
export async function getPrFiles(prNo: number): Promise<string[]> {
  logger.debug({ prNo }, 'getPrFiles');
  const diff = (await api.get(
    `/2.0/repositories/${config.repository}/pullrequests/${prNo}/diff`,
    { json: false } as any
  )).body;
  const files = parseDiff(diff).map(file => file.to);
  return files;
}

export async function updatePr(
  prNo: number,
  title: string,
  description: string
): Promise<void> {
  logger.debug(`updatePr(${prNo}, ${title}, body)`);
  await api.put(`/2.0/repositories/${config.repository}/pullrequests/${prNo}`, {
    body: { title, description: sanitize(description) },
  });
}

export async function mergePr(
  prNo: number,
  branchName: string
): Promise<boolean> {
  logger.debug(`mergePr(${prNo}, ${branchName})`);

  try {
    await api.post(
      `/2.0/repositories/${config.repository}/pullrequests/${prNo}/merge`,
      {
        body: {
          close_source_branch: true,
          merge_strategy: 'merge_commit',
          message: 'auto merged',
        },
      }
    );
    delete config.baseCommitSHA;
    logger.info('Automerging succeeded');
  } catch (err) /* istanbul ignore next */ {
    return false;
  }
  return true;
}

// Pull Request

export function cleanRepo(): void {
  // istanbul ignore if
  if (config.storage && config.storage.cleanRepo) {
    config.storage.cleanRepo();
  }
  config = {} as any;
}

export function getVulnerabilityAlerts(): VulnerabilityAlert[] {
  return [];
}
