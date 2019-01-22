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
    /(go_repository|git_repository|http_archive)\(([\s\S]*?)\n\)\n?/g
  );
  if (!definitions) {
    logger.debug('No matching WORKSPACE definitions found');
    return null;
  }
  logger.debug({ definitions }, `Found ${definitions.length} definitions`);
  const deps = [];
  definitions.forEach(def => {
    logger.debug({ def }, 'Checking bazel definition');
    const [depType] = def.split('(', 1);
    const dep = { depType, def };
    let depName;
    let importpath;
    let remote;
    let currentValue;
    let commit;
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
    match = def.match(/commit = "([^"]+)"/);
    if (match) {
      [, commit] = match;
    }
    match = def.match(/sha256 = "([^"]+)"/);
    if (match) {
      [, sha256] = match;
    }
    match = def.match(/importpath = "([^"]+)"/);
    if (match) {
      [, importpath] = match;
    }
    logger.debug({ dependency: depName, remote, currentValue });
    if (depType === 'git_repository' && depName && remote && currentValue) {
      dep.depName = depName;
      dep.remote = remote;
      dep.currentValue = currentValue;
      const repo = parse(remote).substring('https://github.com/'.length);
      dep.purl = 'pkg:github/' + repo;
      deps.push(dep);
    } else if (
      depType === 'go_repository' &&
      depName &&
      importpath &&
      (currentValue || commit)
    ) {
      dep.depName = depName;
      dep.currentValue = currentValue || commit.substr(0, 7);
      dep.purl = 'pkg:go/' + importpath;
      if (remote) {
        const remoteMatch = remote.match(
          /https:\/\/github\.com(?:.*\/)(([a-zA-Z]+)([-])?([a-zA-Z]+))/
        );
        if (remoteMatch && remoteMatch[0].length === remote.length) {
          dep.purl = 'pkg:go/' + remote.replace('https://', '');
        } else {
          dep.skipReason = 'unsupported-remote';
        }
      }
      if (commit) {
        dep.currentValue = 'v0.0.0';
        dep.currentDigest = commit;
        dep.currentDigestShort = commit.substr(0, 7);
        dep.digestOneAndOnly = true;
      }
      deps.push(dep);
    } else if (
      depType === 'http_archive' &&
      depName &&
      parseUrl(url) &&
      sha256
    ) {
      const parsedUrl = parseUrl(url);
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
