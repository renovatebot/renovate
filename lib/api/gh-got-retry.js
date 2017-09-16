const logger = require('../logger');
const ghGot = require('gh-got');

// istanbul ignore next
function sleep(ms) {
  // eslint-disable-next-line promise/avoid-new
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ghGotRetry(path, opts, retries = 5) {
  try {
    const res = await ghGot(path, opts);
    return res;
  } catch (err) {
    if (err.statusCode >= 500 && err.statusCode < 600 && retries > 0) {
      logger.debug(`Retrying statusCode ${err.statusCode}`);
      // istanbul ignore if
      if (process.env.NODE_ENV !== 'test') {
        await sleep(5000 / retries);
      }
      return ghGotRetry(path, opts, retries - 1);
    }
    if (
      retries > 0 &&
      err.statusCode === 403 &&
      err.message &&
      err.message.indexOf('You have triggered an abuse detection mechanism') ===
        0
    ) {
      logger.debug(`Retrying abuse detection trigger`);
      // istanbul ignore if
      if (process.env.NODE_ENV !== 'test') {
        await sleep(180000 / (retries * retries));
      }
      return ghGotRetry(path, opts, retries - 1);
    }
    if (
      retries > 0 &&
      err.statusCode === 403 &&
      err.message &&
      err.message.indexOf('API rate limit') === 0
    ) {
      logger.debug(`Retrying API rate limit`);
      // istanbul ignore if
      if (process.env.NODE_ENV !== 'test') {
        await sleep(30000 / (retries * retries));
      }
      return ghGotRetry(path, opts, retries - 1);
    }
    throw err;
  }
}

const helpers = ['get', 'post', 'put', 'patch', 'head', 'delete'];

for (const x of helpers) {
  ghGotRetry[x] = async (path, opts, retries = 3) => {
    try {
      const res = await ghGot[x](path, opts);
      return res;
    } catch (err) {
      if (err.statusCode === 502 && retries > 0) {
        return ghGotRetry[x](path, opts, retries - 1);
      }
      throw err;
    }
  };
}

module.exports = ghGotRetry;
