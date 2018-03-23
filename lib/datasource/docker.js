const got = require('got');

module.exports = {
  getDigest,
  getTags,
};

function massageRegistry(input) {
  let registry = input;
  if (!registry || registry === 'docker.io') {
    registry = 'index.docker.io'; // eslint-disable-line no-param-reassign
  }
  if (!registry.match('$https?://')) {
    registry = `https://${registry}`; // eslint-disable-line no-param-reassign
  }
  return registry;
}

function getRepository(pkgName) {
  return pkgName.includes('/') ? pkgName : `library/${pkgName}`;
}

async function getDockerIoHeaders(repository) {
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
    // istanbul ignore if
    if (err.statusCode >= 500 && err.statusCode < 600) {
      logger.warn({ err }, 'docker registry failure: internal error');
      throw new Error('registry-failure');
    }
    logger.info('Error obtaining docker token');
    return null;
  }
}

async function getDigest(registry, name, tag = 'latest') {
  logger.debug(`getDigest(${registry}, ${name}, ${tag})`);
  try {
    const massagedRegistry = massageRegistry(registry);
    const repository = getRepository(name);
    const url = `${massagedRegistry}/v2/${repository}/manifests/${tag}`;
    const headers = await getDockerIoHeaders(repository);
    const digest = (await got(url, { json: true, headers })).headers[
      'docker-content-digest'
    ];
    logger.debug({ digest }, 'Got docker digest');
    return digest;
  } catch (err) {
    // istanbul ignore if
    if (err.statusCode === 401) {
      logger.info(
        { err, body: err.response ? err.response.body : undefined, name, tag },
        'Lookup is unauthorized (private image)'
      );
      return null;
    }
    // istanbul ignore if
    if (err.statusCode === 404) {
      logger.info(
        { err, body: err.response ? err.response.body : undefined, name, tag },
        'Docker Manifest is unknown'
      );
      return null;
    }
    // istanbul ignore if
    if (err.statusCode >= 500 && err.statusCode < 600) {
      logger.warn(
        { err, body: err.response ? err.response.body : undefined, name, tag },
        'docker registry failure: internal error'
      );
      throw new Error('registry-failure');
    }
    logger.info(
      { err, body: err.response ? err.response.body : undefined, name, tag },
      'Unknown Error looking up docker image digest'
    );
    return null;
  }
}

async function getTags(registry, name) {
  logger.debug(`getTags(${registry}, ${name})`);
  try {
    const massagedRegistry = massageRegistry(registry);
    const repository = getRepository(name);
    const url = `${massagedRegistry}/v2/${repository}/tags/list?n=10000`;
    const headers = await getDockerIoHeaders(repository);
    const { tags } = (await got(url, { json: true, headers })).body;
    logger.debug({ length: tags.length }, 'Got docker tags');
    logger.trace({ tags });
    return tags;
  } catch (err) {
    // istanbul ignore if
    if (err.statusCode >= 500 && err.statusCode < 600) {
      logger.warn({ err }, 'docker registry failure: internal error');
      throw new Error('registry-failure');
    }
    logger.warn({ err, name }, 'Error getting docker image tags');
    return null;
  }
}
