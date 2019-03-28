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

function findBalancedParenIndex(hayStack) {
  const needle = ')';
  /**
   * To find needed closing parenthesis we need to increment
   * depth when parser feeds opening parenthesis
   * if one opening parenthesis -> 1
   * if two opening parenthesis -> 2
   * if two opening and one closing parenthesis -> 1
   */
  let parenDepth = 1;
  return [...hayStack]
    .map((char, i) => {
      if (char === '(') parenDepth = +1;
      if (char === needle) parenDepth = -1;
      if (char === needle && parenDepth === 0) return i;

      return null;
    })
    .find(Boolean);
}

function parseContent(content) {
  const definitions = content.match(
    /(go_repository|git_repository)\(([\s\S]*?)\n\)\n?/g
  );

  const prefix = 'http_archive(';
  const suffixBases = content.split(/http_archive\s*\(/g).slice(1);

  const httpDefs = suffixBases
    .map(base => {
      const suffixClosingParenIndex = findBalancedParenIndex(base);
      if (!Number.isInteger(suffixClosingParenIndex)) return null;

      return prefix + base.slice(0, suffixClosingParenIndex) + ')';
    })
    .filter(Boolean);

  return definitions.concat(httpDefs);
}

function extractPackageFile(content) {
  // const definitions = content.match(
  //   /(go_repository|git_repository|http_archive)\(([\s\S]*?)\n\)\n?/g
  // );
  /**
   * ABOVE REGEX NOT CAPABLE TO PARSE COMPLEX CONTENT
   *
   * content.match(/http_archive\s*\(/g).length === 8
   * definitions.length === 4 ????
   * definitions[0].match(/http_archive\s*\(/g).length === 3
   * you can see mistakes
   */
  const definitions = parseContent(content);
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
    let match = def.match(/name\s*=\s*"([^"]+)"/);
    if (match) {
      [, depName] = match;
    }
    match = def.match(/remote\s*=\s*"([^"]+)"/);
    if (match) {
      [, remote] = match;
    }
    match = def.match(/tag\s*=\s*"([^"]+)"/);
    if (match) {
      [, currentValue] = match;
    }
    match = def.match(/url\s*=\s*"([^"]+)"/);
    if (match) {
      [, url] = match;
    }
    match = def.match(/urls\s*=\s*\[\s*"([^\]]+)",?\s*\]/);
    if (match) {
      const urls = match[1].replace(/\s/g, '').split('","');
      url = urls.find(parseUrl);
    }
    match = def.match(/commit\s*=\s*"([^"]+)"/);
    if (match) {
      [, commit] = match;
    }
    match = def.match(/sha256\s*=\s*"([^"]+)"/);
    if (match) {
      [, sha256] = match;
    }
    match = def.match(/importpath\s*=\s*"([^"]+)"/);
    if (match) {
      [, importpath] = match;
    }
    logger.debug({ dependency: depName, remote, currentValue });
    if (
      depType === 'git_repository' &&
      depName &&
      remote &&
      (currentValue || commit)
    ) {
      dep.depName = depName;
      dep.remote = remote;
      if (currentValue) {
        dep.currentValue = currentValue;
      }
      if (commit) {
        dep.currentDigest = commit;
      }
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
    } else if (
      depType === 'http_archive' &&
      depName &&
      parseUrl(url) &&
      sha256
    ) {
      const parsedUrl = parseUrl(url);
      dep.depName = depName;
      dep.repo = parsedUrl.repo;
      if (parsedUrl.currentValue.match(/^[a-f0-9]{40}$/i)) {
        dep.currentDigest = parsedUrl.currentValue;
      } else {
        dep.currentValue = parsedUrl.currentValue;
      }
      dep.datasource = 'github';
      dep.lookupName = dep.repo;
      dep.lookupType = 'releases';
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
