const got = require('got');
const parseLinkHeader = require('parse-link-header');
const parsers = require('www-authenticate').parsers;
const { isVersion, sortVersions } = require('../versioning/docker');

module.exports = {
  getDigest,
  getDependency,
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
  return pkgName.includes('/') ? pkgName : `amd64/${pkgName}`;
}

async function getAuthHeaders(registry, repository) {
  // istanbul ignore if
  try {
    const apiCheckUrl = `${registry}/v2/`
    const apiCheckResponse = (await got(apiCheckUrl, {throwHttpErrors: false}))
    const authenticateHeader = new parsers.WWW_Authenticate(apiCheckResponse.headers['www-authenticate'])

    const authUrl = `${authenticateHeader.parms.realm}?service=${authenticateHeader.parms.service}&scope=repository:${repository}:pull`;
    logger.debug(`Obtaining docker registry token for ${repository} using url ${authUrl}`);
    const { token } = (await got(authUrl, { json: true })).body;
    if (!token) {
      logger.warn('Failed to obtain docker registry token');
      return null;
    }
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.docker.distribution.manifest.v2+json',
    };
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 401) {
      logger.info({ registry, repository }, 'Unauthorized docker lookup');
      logger.debug({
        err,
        message: err.message,
        body: err.response ? err.response.body : undefined,
      });
      return null;
    }
    if (err.statusCode >= 500 && err.statusCode < 600) {
      logger.warn({ err }, 'docker registry failure: internal error');
      throw new Error('registry-failure');
    }
    logger.warn('Error obtaining docker token');
    return null;
  }
}

async function getDigest(config, newValue) {
  const { dockerRegistry, depName, tagSuffix } = config;
  logger.debug(`getDigest(${dockerRegistry}, ${depName}, ${newValue})`);
  const massagedRegistry = massageRegistry(dockerRegistry);
  const repository = getRepository(depName);
  let newTag = newValue;
  if (tagSuffix) {
    newTag += `-${tagSuffix}`;
  }
  try {
    const url = `${massagedRegistry}/v2/${repository}/manifests/${newTag}`;
    const headers = await getAuthHeaders(massagedRegistry, repository);
    if (!headers) {
      logger.info('No docker auth found - returning');
      return null;
    }
    headers.accept = 'application/vnd.docker.distribution.manifest.v2+json';
    const digest = (await got(url, { json: true, headers, timeout: 10000 }))
      .headers['docker-content-digest'];
    logger.debug({ digest }, 'Got docker digest');
    return digest;
  } catch (err) /* istanbul ignore next */ {
    if (err.message === 'registry-failure') {
      throw err;
    }
    if (err.statusCode === 401) {
      logger.info({ dockerRegistry, repository }, 'Unauthorized docker lookup');
      logger.debug({
        err,
        message: err.message,
        body: err.response ? err.response.body : undefined,
      });
      return null;
    }
    if (err.statusCode === 404) {
      logger.info(
        {
          err,
          body: err.response ? err.response.body : undefined,
          depName,
          newTag,
        },
        'Docker Manifest is unknown'
      );
      return null;
    }
    if (err.statusCode >= 500 && err.statusCode < 600) {
      logger.warn(
        {
          err,
          body: err.response ? err.response.body : undefined,
          depName,
          newTag,
        },
        'docker registry failure: internal error'
      );
      throw new Error('registry-failure');
    }
    if (err.code === 'ETIMEDOUT') {
      logger.info(
        { massagedRegistry },
        'Timeout when attempting to connect to docker registry'
      );
      logger.debug({ err });
      return null;
    }
    logger.info(
      {
        err,
        body: err.response ? err.response.body : undefined,
        depName,
        newTag,
      },
      'Unknown Error looking up docker image digest'
    );
    return null;
  }
}

async function getDependency(purl) {
  const { fullname, qualifiers } = purl;
  const { registry, suffix } = qualifiers;
  logger.debug({ fullname, registry, suffix }, 'docker.getDependencies()');
  const massagedRegistry = massageRegistry(registry);
  const repository = getRepository(fullname);
  try {
    let url = `${massagedRegistry}/v2/${repository}/tags/list?n=10000`;
    const headers = await getAuthHeaders(massagedRegistry, repository);
    if (!headers) {
      return null;
    }
    let tags = [];
    let page = 1;
    do {
      const res = await got(url, { json: true, headers, timeout: 10000 });
      tags = tags.concat(res.body.tags);
      const linkHeader = parseLinkHeader(res.headers.link);
      url = linkHeader && linkHeader.next ? linkHeader.next.url : null;
      page += 1;
    } while (url && page < 20);
    logger.debug({ length: tags.length }, 'Got docker tags');
    logger.trace({ tags });
    const releases = tags
      .filter(tag => !suffix || tag.endsWith(`-${suffix}`))
      .map(tag => (suffix ? tag.replace(new RegExp(`-${suffix}$`), '') : tag))
      .filter(isVersion)
      .sort(sortVersions)
      .map(version => ({ version }));
    return { releases };
  } catch (err) /* istanbul ignore next */ {
    logger.debug(
      {
        err,
        fullname,
        message: err.message,
        body: err.response ? err.response.body : undefined,
      },
      'docker.getTags() error'
    );
    if (err.statusCode === 401) {
      logger.info('Not authorised to look up docker tags');
      return null;
    }
    if (err.statusCode >= 500 && err.statusCode < 600) {
      logger.warn({ err }, 'docker registry failure: internal error');
      throw new Error('registry-failure');
    }
    if (err.code === 'ETIMEDOUT') {
      logger.info(
        { massagedRegistry },
        'Timeout when attempting to connect to docker registry'
      );
      logger.debug({ err });
      return null;
    }
    logger.warn('Error getting docker image tags');
    return null;
  }
}
