const got = require('got');
const url = require('url');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
  getPkgReleases,
};

async function getPkgReleases(purl, config) {
  const versions = [];
  const dependency = getDependencyParts(purl);
  const repositories = getRepositories(purl);
  for (let i = 0; i < repositories.length; i++) {
    const repoUrl = repositories[i];
    const mavenMetadata = await downloadMavenMetadata(dependency, repoUrl);
    versions.push(...extractVersions(mavenMetadata));
  }

  return {
    ...dependency,
    releases: versions.map(v => ({ version: v })),
  };
}

function getDependencyParts(purl) {
  return {
    group: purl.namespace,
    name: purl.name,
    version: purl.version,
    dependencyUrl: purl.namespace.replace(/\./g, '/') + `/${purl.name}`,
  };
}

function getRepositories(purl) {
  return [purl.qualifiers.repository_url];
}

async function downloadMavenMetadata(dependency, repoUrl) {
  const pkgUrl = new url.URL(
    `${dependency.dependencyUrl}/maven-metadata.xml`,
    repoUrl
  );

  const pkgPath = pkgUrl.toString().replace('file://', '');
  console.log(path.resolve(pkgPath));
  return await fs.readFile(pkgPath, 'utf8');
}

function extractVersions(mavenMetadata) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(mavenMetadata, 'text/xml');
  const versionsTags = xmlDoc.getElementsByTagName('versions')[0].children;
  const versions = [];
  for (let i = 0; i < versionsTags.length; i++) {
    versions.push(versionsTags[i].firstChild.nodeValue);
  }
  return versions;
}
