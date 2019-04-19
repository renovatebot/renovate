const { parseUrlPath } = require('./extract');
const { skip, isSpace, removeComments } = require('./util');

module.exports = {
  updateDependency,
};

function updateDependency(content, upgrade) {
  /*
    1. Update url field
    2. Update sha256 field
   */
  const { depName, currentValue, url, /* sha256 , */ newValue } = upgrade;
  let newContent = content;
  const newUrl = url.replace(currentValue, newValue);
  if (newValue !== parseUrlPath(newUrl).currentValue) {
    logger.debug(`Failed to update url for dependency ${depName}`);
    return content;
  }
  newContent = updateUrl(content, newUrl);
  // let newSha256 = getNewSha256(url, newValue);
  // newContent = updateSha256(newContent, newSha256);
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

// function getNewSha256() {
//   return null;
// }

// function updateSha256(content, sha256) {
//   return null;
// }
