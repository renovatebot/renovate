const dockerRegistryClient = require('@renovatebot/docker-registry-client');
const got = require('got');
const URL = require('url');
const is = require('@sindresorhus/is');
const parseLinkHeader = require('parse-link-header');
const wwwAuthenticate = require('www-authenticate');
const { isVersion, sortVersions } = require('../versioning/docker');
const hostRules = require('../util/host-rules');

module.exports = {
  getDigest,
  getPkgReleases,
};

function massageRegistry(config, input) {
  let registry = input;
  if (!registry && is.nonEmptyArray(config.registryUrls)) {
    [registry] = config.registryUrls;
  }
  if (!registry || registry === 'docker.io') {
    registry = 'index.docker.io'; // eslint-disable-line no-param-reassign
  }
  if (!registry.match('$https?://')) {
    registry = `https://${registry}`; // eslint-disable-line no-param-reassign
  }
  return registry;
}

function getRepository(pkgName, registry) {
  // The implicit prefix only applies to Docker Hub, not other registries
  if (!registry || registry === 'docker.io') {
    return pkgName.includes('/') ? pkgName : `library/${pkgName}`;
  }

  return pkgName;
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

    // prettier-ignore
    const authUrl = `${authenticateHeader.parms.realm}?service=${authenticateHeader.parms.service}&scope=repository:${repository}:pull`;
    const { host } = URL.parse(registry);
    const opts = hostRules.find({ platform: 'docker', host }, { json: true });
    if (opts.username && opts.password) {
      const auth = Buffer.from(`${opts.username}:${opts.password}`).toString(
        'base64'
      );
      opts.headers = { Authorization: `Basic ${auth}` };
    }
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
      Accept: 'application/vnd.docker.distribution.manifest.v2+json',
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
  const { dockerRegistry, depName } = config;
  logger.debug(`getDigest(${dockerRegistry}, ${depName}, ${newValue})`);
  const massagedRegistry = massageRegistry(config, dockerRegistry);
  const repository = getRepository(depName, dockerRegistry);
  const newTag = newValue || 'latest';
  try {
    const cacheNamespace = 'datasource-docker-digest';
    const cacheKey = `${massagedRegistry}:${repository}:${newTag}`;
    const cachedResult = await renovateCache.get(cacheNamespace, cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
    const manifestResponse = await getManifestResponse(
      massagedRegistry,
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
    logger.debug({ length: tags.length }, 'Got docker tags');
    logger.trace({ tags });
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
 * docker.getLabels
 *
 * This function will:
 *  - Return the labels for the requested image
 */

async function getLabels(registry, repository, tag) {
  logger.debug(`getLabels(${registry}, ${repository}, ${tag})`);
  const manifestResponse = await getManifestResponse(registry, repository, tag);
  // If getting the manifest fails here, then abort
  // This means that the latest tag doesn't have a manifest, which shouldn't
  // be possible
  if (!manifestResponse) {
    logger.warn(
      {
        registry,
        repository,
        tag,
      },
      'docker registry failure: failed to get manifest for tag'
    );
    throw new Error('registry-failure');
  }
  try {
    const manifest = JSON.parse(manifestResponse.body);
    let labels = {};
    if (manifest.schemaVersion === 1) {
      labels = JSON.parse(manifest.history[0].v1Compatibility).container_config
        .Labels;
      if (!labels) {
        labels = {};
      }
    }
    if (manifest.schemaVersion === 2) {
      const config_digest = manifest.config.digest;
      const headers = await getAuthHeaders(registry, repository);
      if (!headers) {
        logger.info('No docker auth found - returning');
        return {};
      }
      const url = `${registry}/v2/${repository}/blobs/${config_digest}`;
      const configResponse = await got(url, {
        headers,
        timeout: 10000,
      });
      labels = JSON.parse(configResponse.body).container_configLabels;
    }

    if (labels) {
      logger.debug(
        {
          labels,
        },
        'found labels in manifest'
      );
    }
    return labels;
  } catch (err) {
    if (err.message === 'registry-failure') {
      throw err;
    }
    if (err.statusCode === 401) {
      logger.info(
        { registry, dockerRepository: repository },
        'Unauthorized docker lookup'
      );
      logger.debug({ err });
      return {};
    }
    if (err.statusCode === 404) {
      logger.warn(
        {
          err,
          registry,
          repository,
          tag,
        },
        'Config Manifest is unknown'
      );
      throw new Error('registry-failure');
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
      return {};
    }
    logger.info(
      {
        err,
        registry,
        repository,
        tag,
      },
      'Unknown Error getting labels'
    );
    return {};
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
 *  - 'alpine' is the tag suffix
 *
 * This function will:
 *  - Fetch all tags
 *  - Filter for tags that match the existing tag suffix, if present
 *  - Filter only tags that contain a semver version
 */

async function getPkgReleases(purl, config = {}) {
  const { fullname, qualifiers } = purl;
  const { registry, suffix } = qualifiers;
  logger.debug({ fullname, registry, suffix }, 'docker.getDependencies()');
  const massagedRegistry = massageRegistry(config, registry);
  const repository = getRepository(fullname, registry);
  const tags = await getTags(massagedRegistry, repository);
  if (!tags) {
    return null;
  }
  const sortedTags = tags
    .filter(tag => !suffix || tag.endsWith(`-${suffix}`))
    .map(tag => (suffix ? tag.replace(new RegExp(`-${suffix}$`), '') : tag))
    .filter(isVersion)
    .sort(sortVersions);

  const releases = sortedTags.map(version => ({ version }));
  const ret = { releases };

  const latestTag = sortedTags[sortedTags.length - 1];

  const labels = await getLabels(massagedRegistry, repository, latestTag);
  if ('org.opencontainers.image.source' in labels) {
    ret.sourceUrl = labels['org.opencontainers.image.source'];
  }

  return ret;
}
