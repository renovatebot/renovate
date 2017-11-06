const got = require('got');

module.exports = {
  getDigest,
  getTags,
};

async function getDigest(name, tag = 'latest', logger) {
  const repository = name.includes('/') ? name : `library/${name}`;
  try {
    const authUrl = `https://auth.docker.io/token?service=registry.docker.io&scope=repository:${repository}:pull`;
    logger.debug(`Obtaining docker registry token for ${repository}`);
    const { token } = (await got(authUrl, { json: true })).body;
    if (!token) {
      logger.warn('Failed to obtain docker registry token');
      return null;
    }
    logger.debug('Got docker registry token');
    const url = `https://index.docker.io/v2/${repository}/manifests/${tag}`;
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.docker.distribution.manifest.v2+json',
    };
    const digest = (await got(url, { json: true, headers })).headers[
      'docker-content-digest'
    ];
    logger.debug({ digest }, 'Got docker digest');
    return digest;
  } catch (err) {
    logger.warn({ err, name, tag }, 'Error getting docker image digest');
    return null;
  }
}

async function getTags(name, logger) {
  const repository = name.includes('/') ? name : `library/${name}`;
  try {
    const authUrl = `https://auth.docker.io/token?service=registry.docker.io&scope=repository:${repository}:pull`;
    logger.debug(`Obtaining docker registry token for ${repository}`);
    const { token } = (await got(authUrl, { json: true })).body;
    if (!token) {
      logger.warn('Failed to obtain docker registry token');
      return null;
    }
    logger.debug('Got docker registry token');
    const url = `https://index.docker.io/v2/${repository}/tags/list?n=10000`;
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.docker.distribution.manifest.v2+json',
    };
    const res = await got(url, { json: true, headers });
    logger.debug({ tags: res.body.tags }, 'Got docker tags');
    return res.body.tags;
  } catch (err) {
    logger.warn({ err, name }, 'Error getting docker image tags');
    return null;
  }
}
