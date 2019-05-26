const URL = require('url');
const got = require('../../util/got');
const delay = require('delay');
const parseLinkHeader = require('parse-link-header');
const pAll = require('p-all');

const hostRules = require('../../util/host-rules');
const { maskToken } = require('../../util/mask');

let stats = {};

let endpoint = 'https://api.github.com/';

async function get(path, options, retries = 5) {
  let url = URL.resolve(endpoint, path);
  const opts = {
    json: true,
    ...hostRules.find({ hostType: 'github', url }),
    ...options,
  };
  const method = opts.method || 'get';
  if (method.toLowerCase() === 'post' && path === 'graphql') {
    // GitHub Enterprise uses unversioned graphql path
    url = url.replace('/v3/', '/');
  }
  logger.trace(`${method.toUpperCase()} ${path}`);
  stats.requests = (stats.requests || []).concat([
    method.toUpperCase() + ' ' + path,
  ]);
  try {
    if (global.appMode) {
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
    const res = await got(url, opts);
    if (res && res.headers) {
      stats.rateLimit = res.headers['x-ratelimit-limit'];
      stats.rateLimitRemaining = res.headers['x-ratelimit-remaining'];
    }
    if (opts.paginate) {
      // Check if result is paginated
      const pageLimit = opts.pageLimit || 10;
      const linkHeader = parseLinkHeader(res.headers.link);
      if (linkHeader && linkHeader.next && linkHeader.last) {
        let lastPage = +linkHeader.last.page;
        if (!process.env.RENOVATE_PAGINATE_ALL && opts.paginate !== 'all') {
          lastPage = Math.min(pageLimit, lastPage);
        }
        const pageNumbers = Array.from(
          new Array(lastPage),
          (x, i) => i + 1
        ).slice(1);
        const queue = pageNumbers.map(page => () => {
          const nextUrl = URL.parse(linkHeader.next.url, true);
          delete nextUrl.search;
          nextUrl.query.page = page;
          return get(
            URL.format(nextUrl),
            { ...opts, paginate: false },
            retries
          );
        });
        const pages = await pAll(queue, { concurrency: 5 });
        res.body = res.body.concat(
          ...pages.filter(Boolean).map(page => page.body)
        );
      }
    }
    // istanbul ignore if
    if (method === 'POST' && path === 'graphql') {
      const goodResult = '{"data":{';
      if (res.body.startsWith(goodResult)) {
        if (retries === 0) {
          logger.info('Recovered graphql query');
        }
      } else if (retries > 0) {
        logger.info('Retrying graphql query');
        opts.body = opts.body.replace('first: 100', 'first: 25');
        return get(path, opts, 0);
      }
    }
    return res;
  } catch (err) {
    if (
      err.name === 'RequestError' &&
      (err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT')
    ) {
      throw new Error('platform-failure');
    }
    if (err.name === 'ParseError') {
      throw new Error('platform-failure');
    }
    if (err.statusCode >= 500 && err.statusCode < 600) {
      if (retries > 0) {
        logger.info(
          { statusCode: err.statusCode, message: err.message },
          `Retrying request`
        );

        await delay(5000 / retries);

        return get(path, opts, retries - 1);
      }
      logger.info({ err }, 'Giving up on GitHub 5xx error');
      throw new Error('platform-failure');
    }
    if (
      err.statusCode === 403 &&
      err.message &&
      err.message.startsWith('You have triggered an abuse detection mechanism')
    ) {
      if (retries > 0) {
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

        return get(path, opts, 0);
      }
      // istanbul ignore next
      throw new Error('platform-failure');
    }
    if (
      err.statusCode === 403 &&
      err.message &&
      err.message.startsWith(
        'Upgrade to GitHub Pro or make this repository public to enable this feature'
      )
    ) {
      // istanbul ignore next
      throw err;
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
    } else if (
      err.statusCode === 403 &&
      err.message &&
      err.message.startsWith('Resource not accessible by integration')
    ) {
      logger.debug({ err }, 'Unauthorized');
      throw new Error('integration-unauthorized');
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
          token: maskToken(opts.token),
          err,
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

get.setAppMode = function setAppMode() {
  // no-op
};

get.reset = function reset() {
  // istanbul ignore if
  if (stats.requests && stats.requests.length > 1) {
    logger.info(
      {
        rateLimit: parseInt(stats.rateLimit, 10),
        requestCount: stats.requests.length,
        rateLimitRemaining: parseInt(stats.rateLimitRemaining, 10),
      },
      'Request stats'
    );
    stats.requests.sort();
    logger.debug({ requests: stats.requests }, 'All requests');
    stats = {};
  }
};

get.setEndpoint = e => {
  endpoint = e;
};

module.exports = get;
