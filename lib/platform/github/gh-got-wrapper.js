const URL = require('url');
const ghGot = require('gh-got');
const delay = require('delay');
const parseLinkHeader = require('parse-link-header');
const endpoints = require('../../util/endpoints');

let cache = {};

async function get(path, options, retries = 5) {
  const { host } = URL.parse(path);
  const opts = {
    ...endpoints.find({ platform: 'github', host }),
    ...options,
  };
  const method = opts.method || 'get';
  const useCache = opts.useCache || true;
  if (method === 'get' && useCache && cache[path]) {
    logger.trace({ path }, 'Returning cached result');
    return cache[path];
  }
  logger.debug(`${method.toUpperCase()} ${path} [retries=${retries}]`);
  try {
    if (appMode) {
      const appAccept = 'application/vnd.github.machine-man-preview+json';
      opts.headers = Object.assign(
        {},
        {
          accept: appAccept,
          'user-agent':
            process.env.RENOVATE_USER_AGENT ||
            'https://github.com/renovatebot/renovate',
        },
        opts.headers
      );
      if (opts.headers.accept !== appAccept) {
        opts.headers.accept = `${appAccept}, ${opts.headers.accept}`;
      }
    }
    const res = await ghGot(path, opts);
    if (opts.paginate) {
      // Check if result is paginated
      const pageLimit = opts.pageLimit || 10;
      const linkHeader = parseLinkHeader(res.headers.link);
      if (linkHeader && linkHeader.next && linkHeader.last) {
        let lastPage = +linkHeader.last.page;
        if (!process.env.RENOVATE_PAGINATE_ALL) {
          lastPage = Math.min(pageLimit, lastPage);
        }
        const pageNumbers = Array.from(
          new Array(lastPage),
          (x, i) => i + 1
        ).slice(1);
        const pages = await Promise.all(
          pageNumbers.map(page => {
            const url = URL.parse(linkHeader.next.url, true);
            delete url.search;
            url.query.page = page;
            return get(URL.format(url), { ...opts, paginate: false }, retries);
          })
        );
        res.body = res.body.concat(
          ...pages.filter(Boolean).map(page => page.body)
        );
      }
    }
    if (
      method === 'get' &&
      (path.startsWith('repos/') ||
        path.startsWith('https://api.github.com/repos/'))
    ) {
      cache[path] = res;
    }
    return res;
  } catch (err) {
    if (err.statusCode >= 500 && err.statusCode < 600) {
      if (retries > 0) {
        logger.info(
          { statusCode: err.statusCode, message: err.message },
          `Retrying request`
        );

        await delay(5000 / retries);

        return get(path, opts, retries - 1);
      }
      throw new Error('platform-failure');
    }
    if (
      retries > 0 &&
      err.statusCode === 403 &&
      err.message &&
      err.message.startsWith('You have triggered an abuse detection mechanism')
    ) {
      logger.info(
        {
          headers: err.headers,
          path,
          statusCode: err.statusCode,
          message: err.message,
        },
        `Retrying request`
      );

      await delay(180000 / (retries * retries));

      return get(path, opts, retries - 1);
    }
    if (
      err.statusCode === 403 &&
      err.message &&
      err.message.includes('rate limit exceeded')
    ) {
      logger.info({ err, headers: err.headers }, 'Rate limit exceeded');
      throw new Error('rate-limit-exceeded');
    } else if (
      err.statusCode === 403 &&
      err.message &&
      err.message.includes('blobs up to 1 MB in size')
    ) {
      throw err;
    } else if (err.statusCode === 403) {
      if (retries > 0) {
        logger.info(
          { statusCode: err.statusCode, message: err.message },
          `Retrying request`
        );

        await delay(60000 / (retries * retries));

        return get(path, opts, retries - 1);
      }
    } else if (
      err.statusCode === 401 &&
      err.message &&
      err.message.includes('Bad credentials')
    ) {
      const rateLimit = err.headers ? err.headers['x-ratelimit-limit'] : -1;
      logger.info(
        {
          err,
          message: err.message,
          rateLimit,
          body: err.response ? err.response.body : undefined,
        },
        'Bad credentials'
      );
      if (rateLimit === '60') {
        throw new Error('platform-failure');
      }
      throw new Error('bad-credentials');
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
  cache = null;
  cache = {};
};

module.exports = get;
