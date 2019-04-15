// TODO: Add simple tests for skip and isSpace
module.exports = {
  skip,
  isSpace,
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
