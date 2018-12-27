const _ = require('lodash');
const got = require('got');
const url = require('url');
const fs = require('fs-extra');
const xmlParser = require('fast-xml-parser');

module.exports = {
  getPkgReleases,
};

// eslint-disable-next-line no-unused-vars
async function getPkgReleases(purl, config) {
  const versions = [];
  const dependency = getDependencyParts(purl);
  const repositories = getRepositories(purl);
  if (repositories.length < 1) {
    logger.error(`No repositories defined for ${dependency.display}`);
    return null;
  }
  logger.debug(
    `Found ${repositories.length} repositories for ${dependency.display}`
  );
  for (let i = 0; i < repositories.length; i += 1) {
    const repoUrl = repositories[i];
    logger.debug(
      `Looking up ${dependency.display} in repository #${i} - ${repoUrl}`
    );
    const mavenMetadata = await downloadMavenMetadata(dependency, repoUrl);
    if (mavenMetadata) {
      const newVersions = extractVersions(mavenMetadata).filter(
        version => !versions.includes(version)
      );
      versions.push(...newVersions);
      logger.debug(`Found ${newVersions.length} new versions for ${dependency.display} in repository ${repoUrl}`); // prettier-ignore
    }
  }

  if (versions.length === 0) {
    logger.warn(`No versions found for ${dependency.display} in ${repositories.length} repositories`); // prettier-ignore
    return null;
  }
  logger.debug(`Found ${versions.length} versions for ${dependency.display}`);

  return {
    ...dependency,
    releases: versions.map(v => ({ version: v })),
  };
}

function getDependencyParts(purl) {
  return {
    display: `${purl.namespace}:${purl.name}`,
    group: purl.namespace,
    name: purl.name,
    version: purl.version,
    dependencyUrl: purl.namespace.replace(/\./g, '/') + `/${purl.name}`,
  };
}

function getRepositories(purl) {
  if (!purl.qualifiers || !purl.qualifiers.repository_url) {
    return [];
  }
  return purl.qualifiers.repository_url.split(',').map(url => {
    if (!url.endsWith('/')) {
      return url + '/';
    }
    return url;
  });
}

async function downloadMavenMetadata(dependency, repoUrl) {
  const pkgUrl = new url.URL(
    `${dependency.dependencyUrl}/maven-metadata.xml`,
    repoUrl
  );
  let mavenMetadata;
  switch (pkgUrl.protocol) {
    case 'file:':
      mavenMetadata = await downloadFileProtocol(pkgUrl);
      break;
    case 'http:':
    case 'https:':
      mavenMetadata = await downloadHttpProtocol(pkgUrl);
      break;
    default:
      logger.error(
        `Invalid protocol ${pkgUrl.protocol} in repository ${repoUrl}`
      );
      return null;
  }
  if (!mavenMetadata) {
    logger.debug(`${dependency.display} not found in repository ${repoUrl}`);
  }
  return mavenMetadata;
}

function extractVersions(mavenMetadata) {
  const doc = xmlParser.parse(mavenMetadata);
  return _.get(doc, 'metadata.versioning.versions.version', []).map(v =>
    String(v)
  );
}

async function downloadFileProtocol(pkgUrl) {
  const pkgPath = pkgUrl.toString().replace('file://', '');
  if (!(await fs.exists(pkgPath))) {
    return null;
  }
  return fs.readFile(pkgPath, 'utf8');
}

async function downloadHttpProtocol(pkgUrl) {
  let raw;
  try {
    raw = await got(pkgUrl);
  } catch (err) {
    if (err.statusCode !== 404) {
      logger.warn(`Error requesting ${pkgUrl} Error Code: ${err.code}`);
    } else {
      logger.debug(`Url not found ${pkgUrl}`);
    }
    return null;
  }
  return raw.body;
}
