import api from './gl-got-wrapper';

const defaults = {
  hostType: 'gitlab',
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
    throw new Error('Init: You must configure a GitLab personal access token');
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

export function cleanRepo() {
  logger.warn('Unimplemented in Gitea: cleanRepo');
}
