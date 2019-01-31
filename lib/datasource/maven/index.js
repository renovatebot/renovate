const got = require('got');
const url = require('url');
const fs = require('fs-extra');
const { XmlDocument } = require('xmldoc');
const is = require('@sindresorhus/is');

module.exports = {
  getPkgReleases,
};

// eslint-disable-next-line no-unused-vars
async function getPkgReleases(purl) {
  const versions = [];
  const dependency = getDependencyParts(purl);
  if (!is.nonEmptyArray(purl.registryUrls)) {
    logger.error(`No repositories defined for ${dependency.display}`);
    return null;
  }
  const repositories = purl.registryUrls.map(repository =>
    repository.replace(/\/?$/, '/')
  );
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
  const [group, name] = purl.lookupName.split('/');
  return {
    display: purl.lookupName.replace('/', ':'),
    group,
    name,
    dependencyUrl: generateMavenUrl(purl),
  };
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
  const doc = new XmlDocument(mavenMetadata);
  const versions = doc.descendantWithPath('versioning.versions');
  const elements = versions && versions.childrenNamed('version');
  if (!elements) return [];
  return elements.map(el => el.val);
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
    if (isNotFoundError(err)) {
      logger.debug(`Url not found ${pkgUrl}`);
    } else if (isTemporalError(err)) {
      logger.warn(`Error requesting ${pkgUrl} Error Code: ${err.statusCode}`);
      if (isMavenCentral(pkgUrl)) {
        throw new Error('registry-failure');
      }
    } else {
      logger.warn(
        `Unknown error requesting ${pkgUrl} Error Code: ${err.statusCode}`
      );
    }
    return null;
  }
  return raw.body;
}

function generateMavenUrl(purl) {
  const [group, name] = purl.lookupName.split('/');
  return group.replace(/\./g, '/') + `/${name}`;
}

function isMavenCentral(pkgUrl) {
  return pkgUrl.host === 'central.maven.org';
}

function isTemporalError(err) {
  return (
    err.statusCode === 429 || (err.statusCode > 500 && err.statusCode < 600)
  );
}

function isNotFoundError(err) {
  return err.statusCode === 404;
}
