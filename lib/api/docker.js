const got = require('got');

module.exports = {
  getDigest,
};

async function getDigest(name, tag, logger) {
  const repository = name.includes('/') ? name : `library/${name}`;
  try {
    const authUrl = `https://auth.docker.io/token?service=registry.docker.io&scope=repository:${repository}:pull`;
    logger.debug(`Obtaining docker registry token for ${repository}`);
    const token = (await got(authUrl, { json: true })).body.token;
    if (!token) {
      logger.warn('Failed to obtain docker registry token');
      return null;
    }
    logger.debug('Got docker registry token');
    const url = `https://index.docker.io/v2/${repository}/manifests/${tag ||
      'latest'}`;
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
