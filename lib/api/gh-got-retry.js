const ghGot = require('gh-got');

function ghGotRetry(path, opts) {
  return ghGot(path, opts);
}

const helpers = ['get', 'post', 'put', 'patch', 'head', 'delete'];

for (const x of helpers) {
  const method = x.toUpperCase();
  ghGotRetry[x] = (url, opts) =>
    ghGotRetry(url, Object.assign({}, opts, { method }));
}

module.exports = ghGotRetry;
