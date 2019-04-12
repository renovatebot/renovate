const semver = require('../../versioning/semver');

module.exports = {
  extractPackageFile,
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
  // const sh256 = extractSha256(content);
  const dep = {
    depName,
    url,
    currentValue,
  };
  if (skipReason) {
    dep.skipReason = skipReason;
  }
  const deps = [dep];
  return { deps };
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
  return null;
}

function parseUrl(idx, content) {
  let i = idx;
  i += 'url'.length;
  i = skip(i, content, c => {
    return isSpace(c);
  });
  const c = content[i];
  if (c !== '"' && c !== "'") {
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
function parseClassHeader(i, content) {
  i = i + 'class'.length;
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

function skip(idx, content, cond) {
  let i = idx;
  while (i < content.length) {
    if (!cond(content[i])) {
      return i;
    }
    i += 1;
  }
  return i;
}

function isSpace(c) {
  return /\s/.test(c);
}
