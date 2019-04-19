const got = require('got');
const crypto = require('crypto');
const semver = require('../../versioning/semver');
const { parseUrlPath } = require('./extract');
const { skip, isSpace, removeComments } = require('./util');

module.exports = {
  updateDependency,
};

async function updateDependency(content, upgrade) {
  /*
    1. Update url field
    2. Update sha256 field
   */
  let newContent = content;
  let newUrl;
  let file;
  // Example urls:
  // "https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz"
  // "https://github.com/aide/aide/releases/download/v0.16.1/aide-0.16.1.tar.gz"
  try {
    newUrl = `https://github.com/${upgrade.ownerName}/${
      upgrade.repoName
    }/releases/download/${upgrade.newValue}/${upgrade.repoName}-${semver.coerce(
      upgrade.newValue
    )}.tar.gz`;
    file = (await got(newUrl, { encoding: null })).body;
  } catch (err) {
    logger.debug(
      'Failed to download release download - trying archive instead'
    );
    newUrl = `https://github.com/${upgrade.ownerName}/${
      upgrade.repoName
    }/archive/${upgrade.newValue}.tar.gz`;
    file = (await got(newUrl, { encoding: null })).body;
  }
  const newSha256 = crypto
    .createHash('sha256')
    .update(file)
    .digest('hex');
  if (upgrade.newValue !== parseUrlPath(newUrl).currentValue) {
    logger.debug(`Failed to update url for dependency ${upgrade.depName}`);
    return content;
  }
  newContent = updateUrl(content, newUrl);
  newContent = newContent.replace(upgrade.sha256, newSha256);
  return newContent;
}

function updateUrl(content, url) {
  const urlRegExp = /(^|\s)url(\s)/;
  let i = content.search(urlRegExp);
  if (isSpace(content[i])) {
    i += 1;
  }
  let newContent = replaceUrl(i, content, url);
  const testContent = getTestContent(content, url);
  while (removeComments(newContent) !== testContent) {
    i += 'url'.length;
    i += content.substring(i).search(urlRegExp);
    if (isSpace(content[i])) {
      i += 1;
    }
    newContent = replaceUrl(i, content, url);
  }
  return newContent;
}

function getTestContent(content, url) {
  const urlRegExp = /(^|\s)url(\s)/;
  const cleanContent = removeComments(content);
  let j = cleanContent.search(urlRegExp);
  if (isSpace(cleanContent[j])) {
    j += 1;
  }
  const testContent = replaceUrl(j, cleanContent, url);
  return testContent;
}

// FIXME: Copy and pasted from parseUrl function in extract.js (refactor)
function replaceUrl(idx, content, url) {
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
  const newContent = content.substring(0, i) + url + content.substring(j);
  return newContent;
}
