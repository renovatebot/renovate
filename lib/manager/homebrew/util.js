// TODO: Add simple tests for skip and isSpace
module.exports = {
  skip,
  isSpace,
  removeComments,
};

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

function removeComments(content) {
  let newContent = removeLineComments(content);
  newContent = removeMultiLineComments(newContent);
  return newContent;
}

// Remove line comments starting with #
function removeLineComments(content) {
  let newContent = '';
  let comment = false;
  for (let i = 0; i < content.length; i += 1) {
    const c = content[i];
    if (c === '#') {
      comment = true;
    }
    if (comment) {
      if (c === '\n') {
        comment = false;
      }
    }
    if (!comment) {
      newContent += c;
    }
  }
  return newContent;
}

// Remove multi-line comments enclosed between =begin and =end
function removeMultiLineComments(content) {
  const beginRegExp = /(^|\n)=begin\s/;
  const endRegExp = /(^|\n)=end\s/;
  let newContent = content;
  let i = newContent.search(beginRegExp);
  let j = newContent.search(endRegExp);
  while (i !== -1 && j !== -1) {
    if (newContent[i] === '\n') {
      i += 1;
    }
    if (newContent[j] === '\n') {
      j += 1;
    }
    j += '=end'.length;
    newContent = newContent.substring(0, i) + newContent.substring(j);
    i = newContent.search(beginRegExp);
    j = newContent.search(endRegExp);
  }
  return newContent;
}
