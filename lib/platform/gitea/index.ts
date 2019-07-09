import api from './gl-got-wrapper';

const defaults = {
  hostType: 'gitlab',
  endpoint: 'https://try.gitea.com/api/v1/',
};

export async function initPlatform({
  endpoint,
  token,
}: {
  endpoint: string;
  token: string;
}) {
  if (!token) {
    throw new Error('Init: You must configure a GitLab personal access token');
  }
  logger.debug(`initPlatform('${endpoint}, '${token})`);
  logger.warn('Unimplemented in Gitea: initPlatform');
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
  logger.info('Autodiscovering GitLab repositories');
  logger.warn('Unimplemented in Gitea: getRepos');
  return {};
}

export function cleanRepo() {
  logger.warn('Unimplemented in Gitea: cleanRepo');
}
