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
    // "http_archive(name="distroless",sha256="f7a6ecfb8174a1dd4713ea3b21621072996ada7e8f1a69e6ae7581be137c6dd6",strip_prefix="distroless-446923c3756ceeaa75888f52fcbdd48bb314fbf8",urls=["https://github.com/GoogleContainerTools/distroless/archive/446923c3756ceeaa75888f52fcbdd48bb314fbf8.tar.gz"])"
    logger.debug({ def }, 'Checking bazel definition');
    const [depType] = def.split('(', 1); // "http_archive"
    const dep = { depType, def };
    let depName;
    let importpath;
    let remote;
    let currentValue;
    let commit;
    let url;
    let sha256;
    let match = def.match(/name = "([^"]+)"/); // null
    if (match) {
      [, depName] = match;
    }
    match = def.match(/remote = "([^"]+)"/); // null
    if (match) {
      [, remote] = match;
    }
    match = def.match(/tag = "([^"]+)"/); // null
    if (match) {
      [, currentValue] = match;
    }
    match = def.match(/url = "([^"]+)"/); // null
    if (match) {
      [, url] = match;
    }
    match = def.match(/urls = \[\s*"([^\]]+)",?\s*\]/); // null
    if (match) {
      const urls = match[1].replace(/\s/g, '').split('","');
      url = urls.find(parseUrl);
    }
    match = def.match(/commit = "([^"]+)"/); // null
    if (match) {
      [, commit] = match;
    }
    match = def.match(/sha256 = "([^"]+)"/); // null
    if (match) {
      [, sha256] = match;
    }
    match = def.match(/importpath = "([^"]+)"/); // null
    if (match) {
      [, importpath] = match;
    }
    logger.debug({ dependency: depName, remote, currentValue });
    if (depType === 'git_repository' && depName && remote && currentValue) {
      // depType === "http_archive"
      dep.depName = depName;
      dep.remote = remote;
      dep.currentValue = currentValue;
      const repo = parse(remote).substring('https://github.com/'.length);
      dep.datasource = 'github';
      dep.lookupName = repo;
      deps.push(dep);
    } else if (
      depType === 'go_repository' &&
      depName &&
      importpath &&
      (currentValue || commit)
    ) {
      dep.depName = depName;
      dep.currentValue = currentValue || commit.substr(0, 7);
      dep.datasource = 'go';
      dep.lookupName = importpath;
      if (remote) {
        const remoteMatch = remote.match(
          /https:\/\/github\.com(?:.*\/)(([a-zA-Z]+)([-])?([a-zA-Z]+))/
        );
        if (remoteMatch && remoteMatch[0].length === remote.length) {
          dep.lookupName = remote.replace('https://', '');
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
    } else if (depType === 'http_archive' && parsableHttpArch(def)) {
      const { urls, subsetsValues } = parsableHttpArch.cache;
      const [extractedSha256, extractedDepName, stripPrefix] = subsetsValues;
      // currently supporting  http_archive with only one url
      const parsedUrl = parseUrl(urls.pop());
      dep.depName = extractedDepName;
      dep.repo = parsedUrl.repo;
      dep.currentValue = parsedUrl.currentValue;
      dep.datasource = 'github';
      dep.sha256 = extractedSha256;
      dep.lookupName = dep.repo;
      dep.stripPrefix = stripPrefix;
      // should be something else
      // dep.lookupType = 'releases';
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

/**
 * Splits http_archive dependency in bazel WORKSPACE definition into urls, sha, name and strip-prefix.
 * Checks if urls.length === 1
 * @param {string} def single dependancy definition
 * @returns {boolean} true if definition is parsed correctly
 */
const parsableHttpArch = def => {
  try {
    const urls = def
      .split('urls')
      .pop()
      .split(/\[|\]|"|'/g)
      .filter(s => s.includes('http'));
    if (urls.length !== 1) throw new Error('urls length should be equal to 1');

    const subsets = ['sha256', 'name', 'strip_prefix'];
    const subsetsValues = subsets
      .map(subset =>
        def
          .split(subset)
          .pop()
          .match(/"(.*?)"/)
          .pop()
      )
      .map((val, ind) => {
        if (!val)
          throw new Error(
            `not acceptable value: ${val} (empty string) for ${subsets[ind]}`
          );
        return val;
      });

    parsableHttpArch.cache = { subsetsValues, urls };

    return true;
  } catch (e) {
    logger.info(
      { def },
      `Failed to parse http_archive dependency in bazel WORKSPACE definition, message: ${e}`
    );
    return false;
  }
};
