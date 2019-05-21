import parseDiff from 'parse-diff';
import api from './bb-got-wrapper';
import * as utils from './utils';
import * as hostRules from '../../util/host-rules';
import GitStorage from '../git/storage';
import { readOnlyIssueBody } from '../utils/read-only-issue-body';
import { appSlug } from '../../config/app-strings';

interface Config {
  baseBranch: string;
  baseCommitSHA: string;
  defaultBranch: string;
  fileList: any[];
  mergeMethod: string;
  owner: string;
  prList: any[];
  repository: string;
  storage: GitStorage;
}

let config: Config = {} as any;

export function initPlatform({
  endpoint,
  username,
  password,
}: {
  endpoint?: string;
  username: string;
  password: string;
}) {
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
  const res = {
    endpoint: 'https://api.bitbucket.org/',
  };
  logger.info('Using default Bitbucket Cloud endpoint: ' + res.endpoint);
  return res;
}

// Get all repositories that the user has access to
export async function getRepos() {
  logger.info('Autodiscovering Bitbucket Cloud repositories');
  try {
    const repos = await utils.accumulateValues(
      `/2.0/repositories/?role=contributor`
    );
    return repos.map((repo: { full_name: string }) => repo.full_name);
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, `bitbucket getRepos error`);
    throw err;
  }
}

// Initialize bitbucket by getting base branch and SHA
export async function initRepo({
  repository,
  localDir,
}: {
  repository: string;
  localDir: string;
}) {
  logger.debug(`initRepo("${repository}")`);
  const opts = hostRules.find({ platform: 'bitbucket' });
  api.reset();
  config = {} as any;
  // TODO: get in touch with @rarkins about lifting up the caching into the app layer
  config.repository = repository;
  const platformConfig: any = {};

  // Always gitFs
  const url = GitStorage.getUrl({
    gitFs: 'https',
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

  try {
    const info = utils.repoInfoTransformer(
      (await api.get(`/2.0/repositories/${repository}`)).body
    );
    platformConfig.privateRepo = info.privateRepo;
    platformConfig.isFork = info.isFork;
    platformConfig.repoFullName = info.repoFullName;
    config.owner = info.owner;
    logger.debug(`${repository} owner = ${config.owner}`);
    config.defaultBranch = info.mainbranch;
    config.baseBranch = config.defaultBranch;
    config.mergeMethod = info.mergeMethod;
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 404) {
      throw new Error('not-found');
    }
    logger.info({ err }, 'Unknown Bitbucket initRepo error');
    throw err;
  }
  delete config.prList;
  delete config.fileList;
  await Promise.all([getPrList(), getFileList()]);
  return platformConfig;
}

// Returns true if repository has rule enforcing PRs are up-to-date with base branch before merging
export function getRepoForceRebase() {
  // BB doesnt have an option to flag staled branches
  return false;
}

export async function setBaseBranch(branchName = config.baseBranch) {
  logger.debug(`Setting baseBranch to ${branchName}`);
  config.baseBranch = branchName;
  delete config.baseCommitSHA;
  delete config.fileList;
  await config.storage.setBaseBranch(branchName);
  await getFileList(branchName);
}

// istanbul ignore next
export function setBranchPrefix(branchPrefix: string) {
  return config.storage.setBranchPrefix(branchPrefix);
}

// Search

// Get full file list
export function getFileList(branchName?: string) {
  return config.storage.getFileList(branchName);
}

// Branch

// Returns true if branch exists, otherwise false
export function branchExists(branchName: string) {
  return config.storage.branchExists(branchName);
}

export function getAllRenovateBranches(branchPrefix: string) {
  return config.storage.getAllRenovateBranches(branchPrefix);
}

export function isBranchStale(branchName: string) {
  return config.storage.isBranchStale(branchName);
}

export function getFile(filePath: string, branchName?: string) {
  return config.storage.getFile(filePath, branchName);
}

export async function deleteBranch(branchName: string, closePr?: boolean) {
  if (closePr) {
    const pr = await findPr(branchName, null, 'open');
    if (pr) {
      await api.post(
        `/2.0/repositories/${config.repository}/pullrequests/${
          pr.number
        }/decline`
      );
    }
  }
  return config.storage.deleteBranch(branchName);
}

export function getBranchLastCommitTime(branchName: string) {
  return config.storage.getBranchLastCommitTime(branchName);
}

// istanbul ignore next
export function getRepoStatus() {
  return config.storage.getRepoStatus();
}

export function mergeBranch(branchName: string) {
  return config.storage.mergeBranch(branchName);
}

export function commitFilesToBranch(
  branchName: string,
  files: any[],
  message: string,
  parentBranch = config.baseBranch
) {
  return config.storage.commitFilesToBranch(
    branchName,
    files,
    message,
    parentBranch
  );
}

export function getCommitMessages() {
  return config.storage.getCommitMessages();
}

// Returns the Pull Request for a branch. Null if not exists.
export async function getBranchPr(branchName: string) {
  logger.debug(`getBranchPr(${branchName})`);
  const existingPr = await findPr(branchName, null, 'open');
  return existingPr ? getPr(existingPr.number) : null;
}

// Returns the combined status for a branch.
export async function getBranchStatus(
  branchName: string,
  requiredStatusChecks?: string[]
) {
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
  const sha = await getBranchCommit(branchName);
  const statuses = await utils.accumulateValues(
    `/2.0/repositories/${config.repository}/commit/${sha}/statuses`
  );
  const noOfFailures = statuses.filter(
    (status: { state: string }) => status.state === 'FAILED'
  ).length;
  logger.debug(
    { branch: branchName, sha, statuses },
    'branch status check result'
  );
  if (noOfFailures) {
    return 'failed';
  }
  return 'success';
}

export async function getBranchStatusCheck(
  branchName: string,
  context: string
) {
  const sha = await getBranchCommit(branchName);
  const statuses = await utils.accumulateValues(
    `/2.0/repositories/${config.repository}/commit/${sha}/statuses`
  );
  const bbState = (
    statuses.find((status: { key: string }) => status.key === context) || {}
  ).state;

  return (
    Object.keys(utils.buildStates).find(
      stateKey => utils.buildStates[stateKey] === bbState
    ) || null
  );
}

export async function setBranchStatus(
  branchName: string,
  context: string,
  description: string,
  state: string,
  targetUrl?: string
) {
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
}

async function findOpenIssues(title: string) {
  try {
    const currentUser = (await api.get('/2.0/user')).body.username;
    const filter = encodeURIComponent(
      [
        `title=${JSON.stringify(title)}`,
        '(state = "new" OR state = "open")',
        `reporter.username="${currentUser}"`,
      ].join(' AND ')
    );
    return (
      (await api.get(
        `/2.0/repositories/${config.repository}/issues?q=${filter}`
      )).body.values || /* istanbul ignore next */ []
    );
  } catch (err) /* istanbul ignore next */ {
    logger.warn('Error finding issues');
    return [];
  }
}

export async function findIssue(title: string) {
  logger.debug(`findIssue(${title})`);
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

async function closeIssue(issueNumber: number) {
  await api.put(
    `/2.0/repositories/${config.repository}/issues/${issueNumber}`,
    {
      body: { state: 'closed' },
    }
  );
}

export async function ensureIssue(title: string, body: string) {
  logger.debug(`ensureIssue()`);
  try {
    const issues = await findOpenIssues(title);
    if (issues.length) {
      // Close any duplicates
      for (const issue of issues.slice(1)) {
        await closeIssue(issue.id);
      }
      const [issue] = issues;
      if (String(issue.content.raw).trim() !== body.trim()) {
        logger.info('Issue updated');
        await api.put(
          `/2.0/repositories/${config.repository}/issues/${issue.id}`,
          {
            body: {
              content: { raw: readOnlyIssueBody(body), markup: 'markdown' },
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
          content: { raw: readOnlyIssueBody(body), markup: 'markdown' },
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

// istanbul ignore next
export function getIssueList() {
  logger.debug(`getIssueList()`);
  // TODO: Needs implementation
  return [];
}

export async function ensureIssueClosing(title: string) {
  const issues = await findOpenIssues(title);
  for (const issue of issues) {
    await closeIssue(issue.id);
  }
}

export function addAssignees(_prNr: number, _assignees: string[]) {
  // Bitbucket supports "participants" and "reviewers" so does not seem to have the concept of "assignee"
  logger.warn('Cannot add assignees');
  return Promise.resolve();
}

export async function addReviewers(prId: number, reviewers: string[]) {
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

// istanbul ignore next
export function deleteLabel() {
  throw new Error('deleteLabel not implemented');
}

export function ensureComment(
  _prNo: number,
  _topic: string | null,
  _content: string
) {
  // https://developer.atlassian.com/bitbucket/api/2/reference/search?q=pullrequest+comment
  logger.warn('Comment functionality not implemented yet');
  return Promise.resolve();
}

export function ensureCommentRemoval(_prNo: number, _topic: string) {
  // The api does not support removing comments
  return Promise.resolve();
}

// istanbul ignore next
function matchesState(state: string, desiredState: string) {
  if (desiredState === 'all') {
    return true;
  }
  if (desiredState[0] === '!') {
    return state !== desiredState.substring(1);
  }
  return state === desiredState;
}

export async function findPr(
  branchName: string,
  prTitle?: string | null,
  state: string = 'all'
) {
  logger.debug(`findPr(${branchName}, ${prTitle}, ${state})`);
  const prList = await getPrList();
  const pr = prList.find(
    (p: { branchName: string; title: string; state: string }) =>
      p.branchName === branchName &&
      (!prTitle || p.title === prTitle) &&
      matchesState(p.state, state)
  );
  if (pr) {
    logger.debug(`Found PR #${pr.number}`);
  }
  return pr;
}

// Creates PR and returns PR number
export async function createPr(
  branchName: string,
  title: string,
  description: string,
  _labels?: string[],
  useDefaultBranch = true
) {
  // labels is not supported in Bitbucket: https://bitbucket.org/site/master/issues/11976/ability-to-add-labels-to-pull-requests-bb

  const base = useDefaultBranch
    ? config.defaultBranch
    : /* istanbul ignore next */ config.baseBranch;

  logger.debug({ repository: config.repository, title, base }, 'Creating PR');

  const body = {
    title,
    description,
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
  };

  const prInfo = (await api.post(
    `/2.0/repositories/${config.repository}/pullrequests`,
    { body }
  )).body;
  const pr = { number: prInfo.id, displayNumber: `Pull Request #${prInfo.id}` };
  // istanbul ignore if
  if (config.prList) {
    config.prList.push(pr);
  }
  return pr;
}

async function isPrConflicted(prNo: number) {
  const diff = (await api.get(
    `/2.0/repositories/${config.repository}/pullrequests/${prNo}/diff`,
    { json: false } as any
  )).body;

  return utils.isConflicted(parseDiff(diff));
}

// Gets details for a PR
export async function getPr(prNo: number) {
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
  };

  if (utils.prStates.open.includes(pr.state)) {
    res.isConflicted = await isPrConflicted(prNo);
    const commits = await utils.accumulateValues(pr.links.commits.href);
    if (commits.length === 1) {
      res.canRebase = true;
    }
  }
  if (await branchExists(pr.source.branch.name)) {
    res.isStale = await isBranchStale(pr.source.branch.name);
  }

  return res;
}

// Return a list of all modified files in a PR
export async function getPrFiles(prNo: number) {
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
) {
  logger.debug(`updatePr(${prNo}, ${title}, body)`);
  await api.put(`/2.0/repositories/${config.repository}/pullrequests/${prNo}`, {
    body: { title, description },
  });
}

export async function mergePr(prNo: number, branchName: string) {
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

export function getPrBody(input: string) {
  // Remove any HTML we use
  return input
    .replace(/<\/?summary>/g, '**')
    .replace(/<\/?details>/g, '')
    .replace(new RegExp(`\n---\n\n.*?<!-- ${appSlug}-rebase -->.*?\n`), '')
    .substring(0, 50000);
}

// Return the commit SHA for a branch
async function getBranchCommit(branchName: string) {
  try {
    const branch = (await api.get(
      `/2.0/repositories/${config.repository}/refs/branches/${branchName}`
    )).body;
    return branch.target.hash;
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err }, `getBranchCommit('${branchName}') failed'`);
    return null;
  }
}

// Pull Request

export async function getPrList() {
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

export function cleanRepo() {
  // istanbul ignore if
  if (config.storage && config.storage.cleanRepo) {
    config.storage.cleanRepo();
  }
  api.reset();
  config = {} as any;
}

export function getVulnerabilityAlerts() {
  return [];
}
