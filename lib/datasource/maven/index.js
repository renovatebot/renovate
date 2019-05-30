const url = require('url');
const fs = require('fs-extra');
const { XmlDocument } = require('xmldoc');
const is = require('@sindresorhus/is');

const { compare } = require('../../versioning/maven/compare');
const { containsPlaceholder } = require('../../manager/maven/extract');
const { downloadHttpProtocol } = require('./util');

module.exports = {
  getPkgReleases,
};

// eslint-disable-next-line no-unused-vars
async function getPkgReleases({ lookupName, registryUrls }) {
  const versions = [];
  const dependency = getDependencyParts(lookupName);
  if (!is.nonEmptyArray(registryUrls)) {
    logger.error(`No repositories defined for ${dependency.display}`);
    return null;
  }
  const repositories = registryUrls.map(repository =>
    repository.replace(/\/?$/, '/')
  );
  logger.debug(
    `Found ${repositories.length} repositories for ${dependency.display}`
  );
  const repoForVersions = {};
  for (let i = 0; i < repositories.length; i += 1) {
    const repoUrl = repositories[i];
    logger.debug(
      `Looking up ${dependency.display} in repository #${i} - ${repoUrl}`
    );
    const mavenMetadata = await downloadMavenXml(
      dependency,
      repoUrl,
      'maven-metadata.xml'
    );
    if (mavenMetadata) {
      const newVersions = extractVersions(mavenMetadata).filter(
        version => !versions.includes(version)
      );
      const latestVersion = getLatestVersion(newVersions);
      if (latestVersion) {
        repoForVersions[latestVersion] = repoUrl;
      }
      versions.push(...newVersions);
      logger.debug(`Found ${newVersions.length} new versions for ${dependency.display} in repository ${repoUrl}`); // prettier-ignore
    }
  }

  if (versions.length === 0) {
    logger.info(`No versions found for ${dependency.display} in ${repositories.length} repositories`); // prettier-ignore
    return null;
  }
  logger.debug(`Found ${versions.length} versions for ${dependency.display}`);
  const latestVersion = getLatestVersion(versions);
  const repoUrl = repoForVersions[latestVersion];
  const dependencyInfo = await getDependencyInfo(
    dependency,
    repoUrl,
    latestVersion
  );

  return {
    ...dependency,
    ...dependencyInfo,
    releases: versions.map(v => ({ version: v })),
  };
}

function getDependencyParts(lookupName) {
  const [group, name] = lookupName.split(':');
  const dependencyUrl = `${group.replace(/\./g, '/')}/${name}`;
  return {
    display: lookupName,
    group,
    name,
    dependencyUrl,
  };
}

async function downloadMavenXml(dependency, repoUrl, dependencyFilePath) {
  const pkgUrl = new url.URL(
    `${dependency.dependencyUrl}/${dependencyFilePath}`,
    repoUrl
  );

  let rawContent;
  switch (pkgUrl.protocol) {
    case 'file:':
      rawContent = await downloadFileProtocol(pkgUrl);
      break;
    case 'http:':
    case 'https:':
      rawContent = await downloadHttpProtocol(pkgUrl);
      break;
    case 's3:':
      logger.debug('Skipping s3 dependency');
      return null;
    default:
      logger.warn(
        `Invalid protocol ${pkgUrl.protocol} in repository ${repoUrl}`
      );
      return null;
  }

  if (!rawContent) {
    logger.debug(`${dependency.display} not found in repository ${repoUrl}`);
    return null;
  }

  try {
    return new XmlDocument(rawContent);
  } catch (e) {
    logger.debug(`Can not parse ${pkgUrl.href} for ${dependency.display}`);
    return null;
  }
}

function extractVersions(metadata) {
  const versions = metadata.descendantWithPath('versioning.versions');
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

function getLatestVersion(versions) {
  if (versions.length === 0) return null;
  return versions.reduce((latestVersion, version) =>
    compare(version, latestVersion) === 1 ? version : latestVersion
  );
}

async function getDependencyInfo(dependency, repoUrl, version) {
  const result = {};
  const path = `${version}/${dependency.name}-${version}.pom`;

  const pomContent = await downloadMavenXml(dependency, repoUrl, path);
  if (!pomContent) return result;

  const homepage = pomContent.valueWithPath('url');
  if (homepage && !containsPlaceholder(homepage)) {
    result.homepage = homepage;
  }

  const sourceUrl = pomContent.valueWithPath('scm.url');
  if (sourceUrl && !containsPlaceholder(sourceUrl)) {
    result.sourceUrl = sourceUrl;
  }

  return result;
}
