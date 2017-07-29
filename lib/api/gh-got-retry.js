const ghGot = require('gh-got');

function ghGotRetry(path, opts) {
  return ghGot(path, opts);
}

const helpers = ['get', 'post', 'put', 'patch', 'head', 'delete'];

for (const x of helpers) {
  ghGotRetry[x] = (url, opts) => ghGot[x](url, opts);
}

module.exports = ghGotRetry;
