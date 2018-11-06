const parse = require('github-url-from-git');
const URL = require('url');

module.exports = {
  extractPackageFile,
};

function parseUrl(urlString) {
  // istanbul ignore if
  if (!urlString) {
    return null;
  }
  const url = URL.parse(urlString);
  if (url.host !== 'github.com') {
    return null;
  }
  const path = url.path.split('/').slice(1);
  const repo = path[0] + '/' + path[1];
  let currentValue = null;
  if (path[2] === 'releases' && path[3] === 'download') {
    currentValue = path[4];
  }
  if (path[2] === 'archive') {
    currentValue = path[3].replace(/\.tar\.gz$/, '');
  }
  if (currentValue) {
    return { repo, currentValue };
  }
  // istanbul ignore next
  return null;
}

function extractPackageFile(content) {
  const definitions = content.match(
    /(git_repository|http_archive)\(([\s\S]*?)\n\)\n?/g
  );
  if (!definitions) {
    logger.debug('No matching WORKSPACE definitions found');
    return null;
  }
  logger.debug({ definitions }, `Found ${definitions.length} definitions`);
  const deps = [];
  definitions.forEach(def => {
    logger.debug({ def }, 'Checking bazel definition');

    const dep = { def, versionScheme: 'semver' };
    let depName;
    let remote;
    let currentValue;
    let url;
    let sha256;
    let match = def.match(/name = "([^"]+)"/);
    if (match) {
      [, depName] = match;
    }
    match = def.match(/remote = "([^"]+)"/);
    if (match) {
      [, remote] = match;
    }
    match = def.match(/tag = "([^"]+)"/);
    if (match) {
      [, currentValue] = match;
    }
    match = def.match(/url = "([^"]+)"/);
    if (match) {
      [, url] = match;
    }
    match = def.match(/urls = \[\s*"([^\]]+)",?\s*\]/);
    if (match) {
      const urls = match[1].replace(/\s/g, '').split('","');
      url = urls.find(parseUrl);
    }
    match = def.match(/sha256 = "([^"]+)"/);
    if (match) {
      [, sha256] = match;
    }
    logger.debug({ dependency: depName, remote, currentValue });
    if (def.startsWith('git_repository') && depName && remote && currentValue) {
      dep.depType = 'git_repository';
      dep.depName = depName;
      dep.remote = remote;
      dep.currentValue = currentValue;
      const repo = parse(remote).substring('https://github.com/'.length);
      dep.purl = 'pkg:github/' + repo;
      deps.push(dep);
    } else if (
      def.startsWith('http_archive') &&
      depName &&
      parseUrl(url) &&
      sha256
    ) {
      const parsedUrl = parseUrl(url);
      dep.depType = 'http_archive';
      dep.depName = depName;
      dep.repo = parsedUrl.repo;
      dep.currentValue = parsedUrl.currentValue;
      dep.purl = 'pkg:github/' + dep.repo + '?ref=release';
      deps.push(dep);
    } else {
      logger.info(
        { def },
        'Failed to find dependency in bazel WORKSPACE definition'
      );
    }
  });
  if (!deps.length) {
    return null;
  }
  return { deps };
}
