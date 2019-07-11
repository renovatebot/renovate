import URL from 'url';
import is from '@sindresorhus/is';

import api from './gl-got-wrapper';
import * as hostRules from '../../util/host-rules';
import GitStorage from '../git/storage';
import { PlatformConfig } from '../common';

let config: {
  storage: GitStorage;
  repository: string;
  localDir: string;
  defaultBranch: string;
  baseBranch: string;
  email: string;
  prList: any[];
  issueList: any[];
  token: string;
} = {} as any;

const defaults = {
  hostType: 'gitea',
  endpoint: 'https://gitea.com/api/v1/',
};

export async function initPlatform({
  endpoint,
  token,
}: {
  endpoint: string;
  token: string;
}) {
  if (!token) {
    throw new Error('Init: You must configure a Gitea personal access token');
  }
  const res = {} as any;
  if (endpoint) {
    res.endpoint = endpoint.replace(/\/?$/, '/'); // always add a trailing slash
    api.setBaseUrl(res.endpoint);
    defaults.endpoint = res.endpoint;
  } else {
    res.endpoint = defaults.endpoint;
    logger.info('Using default Gitea endpoint: ' + res.endpoint);
  }
  try {
    res.gitAuthor = (await api.get(`user?token=${token}`)).body.email;
  } catch (err) {
    logger.info({ err }, 'Error authenticating with Gitea. Check your token');
    throw new Error('Init: Authentication failure');
  }
  return res;
}

// Get all repositories that the user has access to
export async function getRepos() {
  logger.info('Autodiscovering Gitea repositories');
  try {
    // TODO : check paginate capabilities
    // TODO : limit to user repositories (add uid parameter ?)
    // const url = `repos?membership=true&per_page=100`;
    const url = `repos/search/`;
    const res = await api.get(url, { paginate: true });
    logger.info(`Discovered ${res.body.data.length} project(s)`);
    return res.body.data.map((repo: { full_name: string }) => repo.full_name);
  } catch (err) {
    logger.error({ err }, `Gitea getRepos error`);
    throw err;
  }
}

function urlEscape(str: string) {
  return str ? str.replace(/\//g, '%2F') : str;
}

export function cleanRepo() {
  logger.warn('Unimplemented in Gitea: cleanRepo');
}

// Initialize Gitea by getting base branch
export async function initRepo({
  repository,
  localDir,
  token,
}: {
  repository: string;
  localDir: string;
  token: string;
}) {
  config = {} as any;
  config.repository = urlEscape(repository);
  config.localDir = localDir;
  config.token = token;
  let res;
  const platformConfig: PlatformConfig = {} as any;
  try {
    res = await api.get(`repos/${config.repository}`);
    if (res.body.archived) {
      logger.info(
        'Repository is archived - throwing error to abort renovation'
      );
      throw new Error('archived');
    }
    if (res.body.mirror) {
      logger.info(
        'Repository is a mirror - throwing error to abort renovation'
      );
      throw new Error('mirror');
    }
    if (res.body.default_branch === null) {
      logger.info('Repository is empty - throwing error to abort renovation');
      throw new Error('empty');
    }
    config.defaultBranch = res.body.default_branch;
    config.baseBranch = config.defaultBranch;
    platformConfig.isFork = !!res.body.fork;
    logger.debug(`${repository} default branch = ${config.baseBranch}`);
    // Discover our user email
    config.email = (await api.get(`user?token=${config.token}`)).body.email;
    logger.debug('Bot email=' + config.email);
    delete config.prList;
    logger.debug('Enabling Git FS');
    const opts = hostRules.find({
      hostType: defaults.hostType,
      url: defaults.endpoint,
    });
    let url;
    if (res.body.html_url === null) {
      logger.debug('no html_url found. Falling back to old behaviour.');
      const { host, protocol } = URL.parse(defaults.endpoint);
      url = GitStorage.getUrl({
        protocol: protocol!.slice(0, -1) as any,
        auth: 'oauth2:' + opts.token,
        host,
        repository,
      });
    } else {
      logger.debug(`${repository} http URL = ${res.body.html_url}`);
      const repoUrl = URL.parse(`${res.body.html_url}`);
      repoUrl.auth = 'oauth2:' + opts.token;
      url = URL.format(repoUrl);
    }
    config.storage = new GitStorage();
    await config.storage.initRepo({
      ...config,
      url,
    });
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err }, 'Caught initRepo error');
    if (err.message.includes('HEAD is not a symbolic ref')) {
      throw new Error('empty');
    }
    if (['archived', 'empty'].includes(err.message)) {
      throw err;
    }
    if (err.statusCode === 401) {
      throw new Error('forbidden');
    }
    if (err.statusCode === 404) {
      throw new Error('not-found');
    }
    logger.info({ err }, 'Unknown Gitea initRepo error');
    throw err;
  }
  return platformConfig;
}

// Issue

export async function getIssueList() {
  if (!config.issueList) {
    const res = await api.get(`repos/${config.repository}/issues?state=open`, {
      useCache: false,
    });
    // istanbul ignore if
    if (!is.array(res.body)) {
      logger.warn({ responseBody: res.body }, 'Could not retrieve issue list');
      return [];
    }
    config.issueList = res.body.map((i: { iid: number; title: string }) => ({
      iid: i.iid,
      title: i.title,
    }));
  }
  return config.issueList;
}

export async function ensureIssueClosing(title: string) {
  logger.debug(`ensureIssueClosing()`);
  const issueList = await getIssueList();
  for (const issue of issueList) {
    if (issue.title === title) {
      logger.info({ issue }, 'Closing issue');
      await api.put(`repos/${config.repository}/issues/${issue.iid}`, {
        body: { state_event: 'close' },
      });
    }
  }
}

export async function setBaseBranch(branchName = config.baseBranch) {
  logger.debug(`Setting baseBranch to ${branchName}`);
  config.baseBranch = branchName;
  await config.storage.setBaseBranch(branchName);
}

export /* istanbul ignore next */ function setBranchPrefix(
  branchPrefix: string
) {
  return config.storage.setBranchPrefix(branchPrefix);
}

// Search

// Get full file list
export function getFileList(branchName = config.baseBranch) {
  return config.storage.getFileList(branchName);
}

// Branch

// Returns true if branch exists, otherwise false
export function branchExists(branchName: string) {
  return config.storage.branchExists(branchName);
}

// Returns the Pull Request for a branch. Null if not exists.
export async function getBranchPr(branchName: string) {
  logger.debug(`getBranchPr(${branchName})`);
  // istanbul ignore if
  if (!(await branchExists(branchName))) {
    return null;
  }
  // TODO: check paginate
  // TODO: check per_page parameter
  const urlString = `repos/${config.repository}/pulls?state=open&per_page=100`;
  const res = await api.get(urlString, { paginate: true });
  logger.debug(`Got res with ${res.body.length} results`);
  let pr: any = null;
  res.body.forEach((result: { head: { label: string } }) => {
    if (result.head.label === branchName) {
      pr = result;
    }
  });
  if (!pr) {
    return null;
  }
  return getPr(pr.id);
}

export function getFile(filePath: string, branchName?: string) {
  return config.storage.getFile(filePath, branchName);
}

// Returns the combined status for a branch.
export async function getBranchStatus(
  branchName: string,
  requiredStatusChecks?: string[] | null
) {
  logger.debug(`getBranchStatus(${branchName})`);
  if (!requiredStatusChecks) {
    // null means disable status checks, so it always succeeds
    return 'success';
  }
  if (Array.isArray(requiredStatusChecks) && requiredStatusChecks.length) {
    // This is Unsupported
    logger.warn({ requiredStatusChecks }, `Unsupported requiredStatusChecks`);
    return 'failed';
  }

  if (!(await branchExists(branchName))) {
    throw new Error('repository-changed');
  }

  // First, get the branch commit SHA
  const branchSha = await config.storage.getBranchCommit(branchName);
  // Now, check the statuses for that commit
  const url = `repos/${config.repository}/commits/${branchSha}/statuses`;
  const res = await api.get(url);
  logger.debug(`Got res with ${res.body.length} results`);
  if (res.body.length === 0) {
    // Return 'pending' if we have no status checks
    return 'pending';
  }
  let status = 'success';
  // Return 'success' if all are success
  res.body.forEach((check: { status: string; allow_failure?: boolean }) => {
    // If one is failed then don't overwrite that
    if (status !== 'failure') {
      if (!check.allow_failure) {
        if (check.status === 'failed') {
          status = 'failure';
        } else if (check.status !== 'success') {
          ({ status } = check);
        }
      }
    }
  });
  return status;
}

export async function getPr(id: number) {
  logger.debug(`getPr(${id})`);

  // TODO: include_diverged_commits_count ????
  const url = `repos/${config.repository}/pulls/${id}?include_diverged_commits_count=1`;
  const pr = (await api.get(url)).body;
  // Harmonize fields with GitHub
  pr.branchName = pr.head.label;
  pr.number = pr.id;
  pr.displayNumber = `Merge Request #${pr.id}`;
  pr.body = pr.description;
  // TODO: check this state :
  pr.isStale = pr.diverged_commits_count > 0;
  // TODO: check merge status values
  if (!pr.mergeable) {
    logger.debug('pr cannot be merged');
    pr.canMerge = false;
    pr.isConflicted = true;
  } else if (pr.state === 'open') {
    const branchStatus = await getBranchStatus(pr.branchName, []);
    if (branchStatus === 'success') {
      pr.canMerge = true;
    }
  }
  // Check if the most recent branch commit is by us
  // If not then we don't allow it to be rebased, in case someone's changes would be lost
  const branchUrl = `repos/${config.repository}/branches/${urlEscape(
    pr.branchName
  )}`;
  try {
    const branch = (await api.get(branchUrl)).body;
    const branchCommitEmail =
      branch && branch.commit ? branch.commit.author.eemail : null;
    // istanbul ignore if
    if (branchCommitEmail === config.email) {
      pr.canRebase = true;
    } else {
      logger.debug(
        { branchCommitEmail, configEmail: config.email, id: pr.id },
        'Last committer to branch does not match bot email, so PR cannot be rebased.'
      );
      pr.canRebase = false;
    }
  } catch (err) {
    logger.debug({ err }, 'Error getting PR branch');
    if (pr.state === 'open' || err.statusCode !== 404) {
      logger.warn({ err }, 'Error getting PR branch');
      pr.isConflicted = true;
    }
  }
  return pr;
}

export function getCommitMessages() {
  return config.storage.getCommitMessages();
}

export function getVulnerabilityAlerts() {
  logger.warn('Unimplemented in Gitea: getVulnerabilityAlerts');
  return [];
}
