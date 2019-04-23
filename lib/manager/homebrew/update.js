const got = require('got');
const crypto = require('crypto');
const semver = require('../../versioning/semver');
const { parseUrlPath } = require('./extract');
const { skip, isSpace, removeComments } = require('./util');

module.exports = {
  updateDependency,
};

// TODO: Refactor
async function updateDependency(content, upgrade) {
  logger.trace('updateDependency()');
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
  newContent = updateUrl(content, upgrade.url, newUrl);
  newContent = updateSha256(newContent, upgrade.sha256, newSha256);
  if (content === newContent) {
    logger.debug(`Failed to update dependency ${upgrade.depName}`);
  }
  return newContent;
}

function updateUrl(content, oldUrl, newUrl) {
  const urlRegExp = /(^|\s)url(\s)/;
  let i = content.search(urlRegExp);
  if (isSpace(content[i])) {
    i += 1;
  }
  let newContent = replaceUrl(i, content, oldUrl, newUrl);
  const testContent = getUrlTestContent(content, oldUrl, newUrl);
  if (!newContent || !testContent) {
    logger.debug('Failed to update url field');
    return content;
  }
  while (removeComments(newContent) !== testContent) {
    i += 'url'.length;
    i += content.substring(i).search(urlRegExp);
    if (isSpace(content[i])) {
      i += 1;
    }
    newContent = replaceUrl(i, content, oldUrl, newUrl);
  }
  return newContent;
}

function getUrlTestContent(content, oldUrl, newUrl) {
  const urlRegExp = /(^|\s)url(\s)/;
  const cleanContent = removeComments(content);
  let j = cleanContent.search(urlRegExp);
  if (isSpace(cleanContent[j])) {
    j += 1;
  }
  const testContent = replaceUrl(j, cleanContent, oldUrl, newUrl);
  return testContent;
}

function replaceUrl(idx, content, oldUrl, newUrl) {
  let i = idx;
  i += 'url'.length;
  i = skip(i, content, c => isSpace(c));
  const chr = content[i];
  if (chr !== '"' && chr !== "'") {
    return null;
  }
  i += 1;
  const newContent =
    content.substring(0, i) + content.substring(i).replace(oldUrl, newUrl);
  return newContent;
}

function updateSha256(content, oldSha256, newSha256) {
  const sha256RegExp = /(^|\s)sha256(\s)/;
  let i = content.search(sha256RegExp);
  if (isSpace(content[i])) {
    i += 1;
  }
  let newContent = replaceSha256(i, content, oldSha256, newSha256);
  const testContent = getSha256TestContent(content, oldSha256, newSha256);
  if (!newContent || !testContent) {
    logger.debug('Failed to update sha256 field');
    return content;
  }
  while (removeComments(newContent) !== testContent) {
    i += 'sha256'.length;
    i += content.substring(i).search(sha256RegExp);
    if (isSpace(content[i])) {
      i += 1;
    }
    newContent = replaceSha256(i, content, oldSha256, newSha256);
  }
  return newContent;
}

function getSha256TestContent(content, oldSha256, newSha256) {
  const sha256RegExp = /(^|\s)sha256(\s)/;
  const cleanContent = removeComments(content);
  let j = cleanContent.search(sha256RegExp);
  if (isSpace(cleanContent[j])) {
    j += 1;
  }
  const testContent = replaceSha256(j, cleanContent, oldSha256, newSha256);
  return testContent;
}

function replaceSha256(idx, content, oldSha256, newSha256) {
  let i = idx;
  i += 'sha256'.length;
  i = skip(i, content, c => isSpace(c));
  const chr = content[i];
  if (chr !== '"' && chr !== "'") {
    return null;
  }
  i += 1;
  const newContent =
    content.substring(0, i) +
    content.substring(i).replace(oldSha256, newSha256);
  return newContent;
}
