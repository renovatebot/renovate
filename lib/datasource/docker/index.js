const dockerRegistryClient = require('@renovatebot/docker-registry-client');
const URL = require('url');
const is = require('@sindresorhus/is');
const parseLinkHeader = require('parse-link-header');
const wwwAuthenticate = require('www-authenticate');

const got = require('../../util/got/datasource');
const hostRules = require('../../util/host-rules');

module.exports = {
  getDigest,
  getPkgReleases,
};

function getRegistryRepository(lookupName, registryUrls) {
  let registry;
  const split = lookupName.split('/');
  if (split.length > 1 && split[0].includes('.')) {
    [registry] = split;
    split.shift();
  }
  let repository = split.join('/');
  if (!registry && is.nonEmptyArray(registryUrls)) {
    [registry] = registryUrls;
  }
  if (!registry || registry === 'docker.io') {
    registry = 'index.docker.io';
  }
  if (!registry.match('^https?://')) {
    registry = `https://${registry}`;
  }
  if (registry.endsWith('.docker.io') && !repository.includes('/')) {
    repository = 'library/' + repository;
  }
  return {
    registry,
    repository,
  };
}

async function getAuthHeaders(registry, repository) {
  // istanbul ignore if
  try {
    const apiCheckUrl = `${registry}/v2/`;
    const apiCheckResponse = await got(apiCheckUrl, { throwHttpErrors: false });
    if (apiCheckResponse.headers['www-authenticate'] === undefined) {
      return {};
    }
    const authenticateHeader = new wwwAuthenticate.parsers.WWW_Authenticate(
      apiCheckResponse.headers['www-authenticate']
    );

    const { host } = URL.parse(registry);
    const opts = hostRules.find({ platform: 'docker', host }, { json: true });
    if (opts.username && opts.password) {
      const auth = Buffer.from(`${opts.username}:${opts.password}`).toString(
        'base64'
      );
      opts.headers = { Authorization: `Basic ${auth}` };
    }

    if (authenticateHeader.scheme.toUpperCase() === 'BASIC') {
      logger.debug(`Using Basic auth for docker registry ${repository}`);
      await got(apiCheckUrl, opts);
      return opts.headers;
    }

    // prettier-ignore
    const authUrl = `${authenticateHeader.parms.realm}?service=${authenticateHeader.parms.service}&scope=repository:${repository}:pull`;
    logger.debug(
      `Obtaining docker registry token for ${repository} using url ${authUrl}`
    );
    const { token } = (await got(authUrl, opts)).body;
    // istanbul ignore if
    if (!token) {
      logger.warn('Failed to obtain docker registry token');
      return null;
    }
    return {
      Authorization: `Bearer ${token}`,
    };
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 401) {
      logger.info(
        { registry, dockerRepository: repository },
        'Unauthorized docker lookup'
      );
      logger.debug({ err });
      return null;
    }
    if (err.statusCode === 403) {
      logger.info(
        { registry, dockerRepository: repository },
        'Not allowed to access docker registry'
      );
      logger.debug({ err });
      return null;
    }
    if (err.statusCode === 429 && registry.endsWith('docker.io')) {
      logger.warn({ err }, 'docker registry failure: too many requests');
      throw new Error('registry-failure');
    }
    if (err.statusCode >= 500 && err.statusCode < 600) {
      logger.warn({ err }, 'docker registry failure: internal error');
      throw new Error('registry-failure');
    }
    logger.warn(
      { registry, dockerRepository: repository, err },
      'Error obtaining docker token'
    );
    return null;
  }
}

function extractDigestFromResponse(manifestResponse) {
  if (manifestResponse.headers['docker-content-digest'] === undefined) {
    return dockerRegistryClient.digestFromManifestStr(manifestResponse.body);
  }
  return manifestResponse.headers['docker-content-digest'];
}

async function getManifestResponse(registry, repository, tag) {
  logger.debug(`getManifestResponse(${registry}, ${repository}, ${tag})`);
  try {
    const headers = await getAuthHeaders(registry, repository);
    if (!headers) {
      logger.info('No docker auth found - returning');
      return null;
    }
    headers.accept = 'application/vnd.docker.distribution.manifest.v2+json';
    const url = `${registry}/v2/${repository}/manifests/${tag}`;
    const manifestResponse = await got(url, {
      headers,
      timeout: 10000,
    });
    return manifestResponse;
  } catch (err) /* istanbul ignore next */ {
    if (err.message === 'registry-failure') {
      throw err;
    }
    if (err.statusCode === 401) {
      logger.info(
        { registry, dockerRepository: repository },
        'Unauthorized docker lookup'
      );
      logger.debug({ err });
      return null;
    }
    if (err.statusCode === 404) {
      logger.info(
        {
          err,
          registry,
          repository,
          tag,
        },
        'Docker Manifest is unknown'
      );
      return null;
    }
    if (err.statusCode === 429 && registry.endsWith('docker.io')) {
      logger.warn({ err }, 'docker registry failure: too many requests');
      throw new Error('registry-failure');
    }
    if (err.statusCode >= 500 && err.statusCode < 600) {
      logger.warn(
        {
          err,
          registry,
          repository,
          tag,
        },
        'docker registry failure: internal error'
      );
      throw new Error('registry-failure');
    }
    if (err.code === 'ETIMEDOUT') {
      logger.info(
        { registry },
        'Timeout when attempting to connect to docker registry'
      );
      logger.debug({ err });
      return null;
    }
    logger.info(
      {
        err,
        registry,
        repository,
        tag,
      },
      'Unknown Error looking up docker manifest'
    );
    return null;
  }
}

/*
 * docker.getDigest
 *
 * The `newValue` supplied here should be a valid tag for the docker image.
 *
 * This function will:
 *  - Look up a sha256 digest for a tag on its registry
 *  - Return the digest as a string
 */

async function getDigest(config, newValue) {
  const { registryUrls, depName } = config;
  const { registry, repository } = getRegistryRepository(depName, registryUrls);
  logger.debug(`getDigest(${registry}, ${repository}, ${newValue})`);
  const newTag = newValue || 'latest';
  try {
    const cacheNamespace = 'datasource-docker-digest';
    const cacheKey = `${registry}:${repository}:${newTag}`;
    const cachedResult = await renovateCache.get(cacheNamespace, cacheKey);
    // istanbul ignore if
    if (cachedResult) {
      return cachedResult;
    }
    const manifestResponse = await getManifestResponse(
      registry,
      repository,
      newTag
    );
    if (!manifestResponse) {
      return null;
    }
    const digest = extractDigestFromResponse(manifestResponse);
    logger.debug({ digest }, 'Got docker digest');
    const cacheMinutes = 30;
    await renovateCache.set(cacheNamespace, cacheKey, digest, cacheMinutes);
    return digest;
  } catch (err) /* istanbul ignore next */ {
    if (err.message === 'registry-failure') {
      throw err;
    }
    logger.info(
      {
        err,
        depName,
        newTag,
      },
      'Unknown Error looking up docker image digest'
    );
    return null;
  }
}

async function getTags(registry, repository) {
  let tags = [];
  try {
    const cacheNamespace = 'datasource-docker-tags';
    const cacheKey = `${registry}:${repository}`;
    const cachedResult = await renovateCache.get(cacheNamespace, cacheKey);
    // istanbul ignore if
    if (cachedResult) {
      return cachedResult;
    }
    let url = `${registry}/v2/${repository}/tags/list?n=10000`;
    const headers = await getAuthHeaders(registry, repository);
    if (!headers) {
      return null;
    }
    let page = 1;
    do {
      const res = await got(url, { json: true, headers, timeout: 10000 });
      tags = tags.concat(res.body.tags);
      const linkHeader = parseLinkHeader(res.headers.link);
      url =
        linkHeader && linkHeader.next
          ? URL.resolve(url, linkHeader.next.url)
          : null;
      page += 1;
    } while (url && page < 20);
    const cacheMinutes = 15;
    await renovateCache.set(cacheNamespace, cacheKey, tags, cacheMinutes);
    return tags;
  } catch (err) /* istanbul ignore next */ {
    logger.debug(
      {
        err,
      },
      'docker.getTags() error'
    );
    if (err.statusCode === 404 && !repository.includes('/')) {
      logger.info(
        `Retrying Tags for ${registry}/${repository} using library/ prefix`
      );
      return getTags(registry, 'library/' + repository);
    }
    if (err.statusCode === 401) {
      logger.info(
        { registry, dockerRepository: repository, err },
        'Not authorised to look up docker tags'
      );
      return null;
    }
    if (err.statusCode === 429 && registry.endsWith('docker.io')) {
      logger.warn(
        { registry, dockerRepository: repository, err },
        'docker registry failure: too many requests'
      );
      throw new Error('registry-failure');
    }
    if (err.statusCode >= 500 && err.statusCode < 600) {
      logger.warn(
        { registry, dockerRepository: repository, err },
        'docker registry failure: internal error'
      );
      throw new Error('registry-failure');
    }
    if (err.code === 'ETIMEDOUT') {
      logger.info(
        { registry },
        'Timeout when attempting to connect to docker registry'
      );
      return null;
    }
    logger.warn(
      { registry, dockerRepository: repository, err },
      'Error getting docker image tags'
    );
    return null;
  }
}

/*
 * docker.getPkgReleases
 *
 * A docker image usually looks something like this: somehost.io/owner/repo:8.1.0-alpine
 * In the above:
 *  - 'somehost.io' is the registry
 *  - 'owner/repo' is the package name
 *  - '8.1.0-alpine' is the tag
 *
 * This function will filter only tags that contain a semver version
 */

async function getPkgReleases(purl, config = {}) {
  const { registry, repository } = getRegistryRepository(
    purl.lookupName,
    config.registryUrls
  );
  const tags = await getTags(registry, repository);
  if (!tags) {
    return null;
  }
  const releases = tags.map(version => ({ version }));
  const ret = { releases };
  return ret;
}
