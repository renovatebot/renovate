const ghGot = require('gh-got');
const parseLinkHeader = require('parse-link-header');

let cache = {};

// istanbul ignore next
function sleep(ms) {
  // eslint-disable-next-line promise/avoid-new
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function get(path, opts, retries = 5) {
  const method = opts && opts.method ? opts.method : 'get';
  logger.debug(`${method.toUpperCase()} ${path} [retries=${retries}]`);
  if (method === 'get' && cache[path]) {
    logger.trace({ path }, 'Returning cached result');
    return cache[path];
  }
  try {
    if (appMode) {
      /* eslint-disable no-param-reassign */
      opts = Object.assign({}, opts);
      const appAccept = 'application/vnd.github.machine-man-preview+json';
      opts.headers = Object.assign(
        {},
        {
          accept: appAccept,
          'user-agent': 'https://github.com/renovateapp/renovate',
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
      const linkHeader = parseLinkHeader(res.headers.link);
      if (linkHeader && linkHeader.next && linkHeader.next.page !== '11') {
        res.body = res.body.concat(
          (await get(linkHeader.next.url, opts, retries)).body
        );
      }
    }
    if (method === 'get' && path.startsWith('repos/')) {
      cache[path] = res;
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
    } else if (
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
    } else if (
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
    } else if (
      err.statusCode === 401 &&
      err.message &&
      err.message.indexOf('Bad credentials') !== -1
    ) {
      if (retries > 0) {
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

get.reset = function reset() {
  cache = {};
};

module.exports = get;
