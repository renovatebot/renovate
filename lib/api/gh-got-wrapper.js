const logger = require('../logger');
const ghGot = require('gh-got');

// istanbul ignore next
function sleep(ms) {
  // eslint-disable-next-line promise/avoid-new
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function get(path, opts, retries = 5) {
  try {
    if (appMode) {
      /* eslint-disable no-param-reassign */
      opts = Object.assign({}, opts);
      const appAccept = 'application/vnd.github.machine-man-preview+json';
      opts.headers = Object.assign(
        {},
        {
          accept: appAccept,
          'user-agent': 'https://github.com/singapore/renovate',
        },
        opts.headers
      );
      if (opts.headers.accept !== appAccept) {
        opts.headers.accept = `${appAccept}, ${opts.headers.accept}`;
      }
    }
    const res = await ghGot(path, opts);
    if (opts && opts.paginate) {
      // Check if result is paginated
      const linkHeader =
        res && res.headers && res.headers.link ? res.headers.link : '';
      const matches = linkHeader.match(
        /<https:\/\/api.github\.com\/(.*?)>; rel="next".*/
      );
      if (matches) {
        res.body = res.body.concat((await get(matches[1], opts, retries)).body);
      }
    }
    return res;
  } catch (err) {
    if (err.statusCode >= 500 && err.statusCode < 600 && retries > 0) {
      logger.info(
        { statusCode: err.statusCode, message: err.message },
        `Retrying request`
      );
      // istanbul ignore if
      if (process.env.NODE_ENV !== 'test') {
        await sleep(5000 / retries);
      }
      return get(path, opts, retries - 1);
    }
    if (
      retries > 0 &&
      err.statusCode === 403 &&
      err.message &&
      err.message.indexOf('You have triggered an abuse detection mechanism') ===
        0
    ) {
      logger.info(
        { statusCode: err.statusCode, message: err.message },
        `Retrying request`
      );
      // istanbul ignore if
      if (process.env.NODE_ENV !== 'test') {
        await sleep(180000 / (retries * retries));
      }
      return get(path, opts, retries - 1);
    }
    if (
      err.statusCode === 403 &&
      err.message &&
      err.message.indexOf('rate limit exceeded') !== -1
    ) {
      if (retries > 0) {
        logger.info(
          { statusCode: err.statusCode, message: err.message },
          `Retrying request`
        );
        // istanbul ignore if
        if (process.env.NODE_ENV !== 'test') {
          await sleep(60000 / (retries * retries));
        }
        return get(path, opts, retries - 1);
      }
      logger.info({ headers: err.headers }, 'Failed retrying request');
    }
    throw err;
  }
}

const helpers = ['get', 'post', 'put', 'patch', 'head', 'delete'];

for (const x of helpers) {
  get[x] = (url, opts) =>
    get(url, Object.assign({}, opts, { method: x.toUpperCase() }));
}

let appMode = false;
get.setAppMode = function setAppMode(val) {
  appMode = val;
};

module.exports = get;
