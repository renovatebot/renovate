const { parseCurrentValue } = require('./extract');
const { skip, isSpace } = require('./util');

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
  if (newValue !== parseCurrentValue(newUrl)) {
    logger.debug(`Failed to update url for dependency ${depName}`);
    return content;
  }
  // FIXME: This will break for commented out `// url 'http://example.com'` line
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
  const newContent = replaceUrl(i, content, url);
  return newContent;
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
