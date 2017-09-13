const got = require('got');

module.exports = {
  getDigest,
};

async function getDigest(name, currentTag, logger) {
  const repository = name.includes('/') ? name : `library/${name}`;
  const tag = currentTag || 'latest';
  try {
    const authUrl = `https://auth.docker.io/token?service=registry.docker.io&scope=repository:${repository}:pull`;
    logger.debug(`Obtaining docker registry token for ${repository}`);
    const token = (await got(authUrl, { json: true })).body.token;
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
    const newDigest = (await got(url, { json: true, headers })).headers[
      'docker-content-digest'
    ];
    logger.debug({ newDigest }, 'Got new docker digest');
    return newDigest;
  } catch (err) {
    logger.warn({ err, name }, 'Error getting docker registry token');
    return null;
  }
}
