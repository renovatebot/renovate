import URL from 'url';

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
