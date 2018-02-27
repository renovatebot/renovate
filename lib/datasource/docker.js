const got = require('got');

module.exports = {
  getDigest,
  getTags,
};

const registry = 'https://index.docker.io/v2';

function getRepository(pkgName) {
  return pkgName.includes('/') ? pkgName : `library/${pkgName}`;
}

async function getHeaders(repository) {
  try {
    const authUrl = `https://auth.docker.io/token?service=registry.docker.io&scope=repository:${repository}:pull`;
    logger.debug(`Obtaining docker registry token for ${repository}`);
    const { token } = (await got(authUrl, { json: true })).body;
    if (!token) {
      logger.warn('Failed to obtain docker registry token');
      return null;
    }
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.docker.distribution.manifest.v2+json',
    };
  } catch (err) {
    logger.info('Error obtaining docker token');
    return null;
  }
}

async function getDigest(name, tag = 'latest') {
  try {
    const repository = getRepository(name);
    const headers = await getHeaders(repository);
    const url = `${registry}/${repository}/manifests/${tag}`;
    const digest = (await got(url, { json: true, headers })).headers[
      'docker-content-digest'
    ];
    logger.debug({ digest }, 'Got docker digest');
    return digest;
  } catch (err) {
    logger.info({ err, name, tag }, 'Error looking up docker image digest');
    return null;
  }
}

async function getTags(name) {
  try {
    const repository = getRepository(name);
    const url = `${registry}/${repository}/tags/list?n=10000`;
    const headers = await getHeaders(repository);
    const { tags } = (await got(url, { json: true, headers })).body;
    logger.debug({ tags }, 'Got docker tags');
    return tags;
  } catch (err) {
    logger.warn({ err, name }, 'Error getting docker image tags');
    return null;
  }
}
