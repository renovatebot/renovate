const semver = require('../../versioning/semver');
const { skip, isSpace, removeComments } = require('./util');

const { logger } = require('../../logger');

module.exports = {
  extractPackageFile,
  parseUrlPath,
};

// TODO: Maybe check if quotes/double-quotes are balanced
function extractPackageFile(content) {
  logger.trace('extractPackageFile()');
  /*
    1. match "class className < Formula"
    2. extract className
    3. extract url field (get depName from url)
    4. extract sha256 field
  */
  const cleanContent = removeComments(content);
  const className = extractClassName(cleanContent);
  if (!className) {
    logger.debug('Invalid class definition');
    return null;
  }
  const url = extractUrl(cleanContent);
  if (!url) {
    logger.debug('Invalid URL field');
  }
  const urlPathResult = parseUrlPath(url);
  let skipReason;
  let currentValue = null;
  let ownerName = null;
  let repoName = null;
  if (urlPathResult) {
    currentValue = urlPathResult.currentValue;
    ownerName = urlPathResult.ownerName;
    repoName = urlPathResult.repoName;
  } else {
    logger.debug('Error: Unsupported URL field');
    skipReason = 'unsupported-url';
  }
  const sha256 = extractSha256(cleanContent);
  if (!sha256 || sha256.length !== 64) {
    logger.debug('Error: Invalid sha256 field');
    skipReason = 'invalid-sha256';
  }
  const dep = {
    depName: `${ownerName}/${repoName}`,
    url,
    sha256,
    ownerName,
    repoName,
    currentValue,
    datasource: 'github',
  };
  if (skipReason) {
    dep.skipReason = skipReason;
    if (skipReason === 'unsupported-url') {
      dep.depName = className;
      dep.datasource = null;
    }
  }
  const deps = [dep];
  return { deps };
}

function extractSha256(content) {
  const sha256RegExp = /(^|\s)sha256(\s)/;
  let i = content.search(sha256RegExp);
  if (isSpace(content[i])) {
    i += 1;
  }
  return parseSha256(i, content);
}

function parseSha256(idx, content) {
  let i = idx;
  i += 'sha256'.length;
  i = skip(i, content, c => {
    return isSpace(c);
  });
  if (content[i] !== '"' && content[i] !== "'") {
    return null;
  }
  i += 1;
  let j = i;
  j = skip(i, content, c => {
    return c !== '"' && c !== "'";
  });
  const sha256 = content.slice(i, j);
  return sha256;
}

function extractUrl(content) {
  const urlRegExp = /(^|\s)url(\s)/;
  let i = content.search(urlRegExp);
  // content.search() returns -1 if not found
  if (i === -1) {
    return null;
  }
  /* istanbul ignore else */
  if (isSpace(content[i])) {
    i += 1;
  }
  return parseUrl(i, content);
}

function parseUrlPath(urlStr) {
  if (!urlStr) {
    return null;
  }
  try {
    const url = new URL(urlStr);
    if (url.hostname !== 'github.com') {
      return null;
    }
    let s = url.pathname.split('/');
    s = s.filter(val => val);
    const ownerName = s[0];
    const repoName = s[1];
    let currentValue;
    if (s[2] === 'archive') {
      currentValue = s[3];
      const targz = currentValue.slice(
        currentValue.length - 7,
        currentValue.length
      );
      if (targz === '.tar.gz') {
        currentValue = currentValue.substring(0, currentValue.length - 7);
      }
    } else if (s[2] === 'releases' && s[3] === 'download') {
      currentValue = s[4];
    }
    if (!currentValue) {
      return null;
    }
    if (!semver.isValid(currentValue)) {
      return null;
    }
    return { currentValue, ownerName, repoName };
  } catch (_) {
    return null;
  }
}

function parseUrl(idx, content) {
  let i = idx;
  i += 'url'.length;
  i = skip(i, content, c => {
    return isSpace(c);
  });
  const chr = content[i];
  if (chr !== '"' && chr !== "'") {
    return null;
  }
  i += 1;
  let j = i;
  j = skip(i, content, c => {
    return c !== '"' && c !== "'" && !isSpace(c);
  });
  const url = content.slice(i, j);
  return url;
}

function extractClassName(content) {
  const classRegExp = /(^|\s)class\s/;
  let i = content.search(classRegExp);
  if (isSpace(content[i])) {
    i += 1;
  }
  return parseClassHeader(i, content);
}

/* This function parses the "class className < Formula" header
   and returns the className and index of the character just after the header */
function parseClassHeader(idx, content) {
  let i = idx;
  i += 'class'.length;
  i = skip(i, content, c => {
    return isSpace(c);
  });
  // Skip all non space and non '<' characters
  let j = skip(i, content, c => {
    return !isSpace(c) && c !== '<';
  });
  const className = content.slice(i, j);
  i = j;
  // Skip spaces
  i = skip(i, content, c => {
    return isSpace(c);
  });
  if (content[i] === '<') {
    i += 1;
  } else {
    return null;
  } // Skip spaces
  i = skip(i, content, c => {
    return isSpace(c);
  });
  // Skip non-spaces
  j = skip(i, content, c => {
    return !isSpace(c);
  });
  if (content.slice(i, j) !== 'Formula') {
    return null;
  }
  return className;
}
