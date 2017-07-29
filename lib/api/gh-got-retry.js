const ghGot = require('gh-got');
const pRetry = require('p-retry');

function ghGotRetry(path, opts) {
  const run = () =>
    ghGot(path, opts).catch(err => {
      if (err.statusCode !== 502) {
        throw new pRetry.AbortError(err);
      }
      throw err;
    });
  return pRetry(run, { retries: 5 });
}

const helpers = ['get', 'post', 'put', 'patch', 'head', 'delete'];

for (const x of helpers) {
  const method = x.toUpperCase();
  ghGotRetry[x] = (url, opts) =>
    ghGotRetry(url, Object.assign({}, opts, { method }));
}

module.exports = ghGotRetry;
