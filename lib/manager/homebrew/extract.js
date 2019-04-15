const semver = require('../../versioning/semver');
const { skip, isSpace } = require('./util');

module.exports = {
  extractPackageFile,
  parseCurrentValue,
};

function extractPackageFile(content) {
  /*
    1. match "class depName < Formula"
    2. extract depName
    3. extract url field
    4. extract sha256 field
  */
  const depName = extractDepName(content);
  if (!depName) {
    logger.debug('Invalid class definition');
    return null;
  }
  const url = extractUrl(content);
  if (!url) {
    logger.debug('Invalid URL field');
  }
  const currentValue = parseCurrentValue(url);
  let skipReason;
  if (!currentValue) {
    logger.debug('Error: Unsupported URL field');
    skipReason = 'unsupported-url';
  }
  const sha256 = extractSha256(content);
  if (!sha256 || sha256.length !== 64) {
    logger.debug('Error: Invalid sha256 field');
    skipReason = 'invalid-sha256';
  }
  const dep = {
    depName,
    url,
    sha256,
    currentValue,
  };
  if (skipReason) {
    dep.skipReason = skipReason;
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
  if (isSpace(content[i])) {
    i += 1;
  }
  return parseUrl(i, content);
}

function parseCurrentValue(urlStr) {
  if (!urlStr) {
    return null;
  }
  try {
    const url = new URL(urlStr);
    if (url.hostname !== 'github.com') {
      return null;
    }
    const s = url.pathname.split('/');
    let currentValue;
    if (s[3] === 'archive') {
      currentValue = s[4];
      const targz = currentValue.slice(
        currentValue.length - 7,
        currentValue.length
      );
      if (targz === '.tar.gz') {
        currentValue = currentValue.substring(0, currentValue.length - 7);
      }
    } else if (s[3] === 'releases' && s[4] === 'download') {
      currentValue = s[5];
    }
    if (!currentValue) {
      return null;
    }
    if (!semver.isValid(currentValue)) {
      return null;
    }
    return currentValue;
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

function extractDepName(content) {
  const classRegExp = /(^|\s)class\s/;
  let i = content.search(classRegExp);
  if (isSpace(content[i])) {
    i += 1;
  }
  return parseClassHeader(i, content);
}

/* This function parses the "class depName < Formula" header
   and returns the depName and index of the character just after the header */
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
  const depName = content.slice(i, j);
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
  return depName;
}
