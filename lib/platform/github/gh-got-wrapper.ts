import URL from 'url';
import parseLinkHeader from 'parse-link-header';
import pAll from 'p-all';

import got from '../../util/got';
import { maskToken } from '../../util/mask';
import { GotApi } from '../common';
import { logger } from '../../logger';

const hostType = 'github';
let baseUrl = 'https://api.github.com/';

async function get(
  path: string,
  options?: any,
  okToRetry = true
): Promise<any> {
  const opts = {
    hostType,
    baseUrl,
    json: true,
    ...options,
  };
  const method = opts.method || 'get';
  if (method.toLowerCase() === 'post' && path === 'graphql') {
    // GitHub Enterprise uses unversioned graphql path
    opts.baseUrl = opts.baseUrl.replace('/v3/', '/');
  }
  logger.trace(`${method.toUpperCase()} ${path}`);
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
    const res = await got(path, opts);
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
          nextUrl.query.page = page.toString();
          return get(
            URL.format(nextUrl),
            { ...opts, paginate: false },
            okToRetry
          );
        });
        const pages = await pAll<{ body: any[] }>(queue, { concurrency: 5 });
        res.body = res.body.concat(
          ...pages.filter(Boolean).map(page => page.body)
        );
      }
    }
    // istanbul ignore if
    if (method === 'POST' && path === 'graphql') {
      const goodResult = '{"data":{';
      if (res.body.startsWith(goodResult)) {
        if (!okToRetry) {
          logger.info('Recovered graphql query');
        }
      } else if (okToRetry) {
        logger.info('Retrying graphql query');
        opts.body = opts.body.replace('first: 100', 'first: 25');
        return get(path, opts, !okToRetry);
      }
    }
    return res;
  } catch (err) /* istanbul ignore next */ {
    let message = err.message;
    if (err.body && err.body.message) {
      message = err.body.message;
    }
    if (
      err.name === 'RequestError' &&
      (err.code === 'ENOTFOUND' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'EAI_AGAIN')
    ) {
      logger.info({ err }, 'GitHub failure: RequestError');
      throw new Error('platform-failure');
    }
    if (err.name === 'ParseError') {
      logger.info({ err }, 'GitHub failure: ParseError');
      throw new Error('platform-failure');
    }
    if (err.statusCode >= 500 && err.statusCode < 600) {
      logger.info({ err }, 'GitHub failure: 5xx');
      throw new Error('platform-failure');
    }
    if (
      err.statusCode === 403 &&
      message.startsWith('You have triggered an abuse detection mechanism')
    ) {
      logger.info({ err }, 'GitHub failure: abuse detection');
      throw new Error('platform-failure');
    }
    if (err.statusCode === 403 && message.includes('Upgrade to GitHub Pro')) {
      logger.debug({ path }, 'Endpoint needs paid GitHub plan');
      throw err;
    }
    if (err.statusCode === 403 && message.includes('rate limit exceeded')) {
      logger.info({ err }, 'GitHub failure: rate limit');
      throw new Error('rate-limit-exceeded');
    } else if (
      err.statusCode === 403 &&
      message.startsWith('Resource not accessible by integration')
    ) {
      logger.info(
        { err },
        'GitHub failure: Resource not accessible by integration'
      );
      throw new Error('integration-unauthorized');
    } else if (err.statusCode === 401 && message.includes('Bad credentials')) {
      const rateLimit = err.headers ? err.headers['x-ratelimit-limit'] : -1;
      logger.info(
        {
          token: maskToken(opts.token),
          err,
        },
        'GitHub failure: Bad credentials'
      );
      if (rateLimit === '60') {
        throw new Error('platform-failure');
      }
      throw new Error('bad-credentials');
    } else if (err.statusCode === 422) {
      if (
        err.body &&
        err.body.errors &&
        err.body.errors.find((e: any) => e.code === 'invalid')
      ) {
        throw new Error('repository-changed');
      }
      throw new Error('platform-failure');
    }
    throw err;
  }
}

const helpers = ['get', 'post', 'put', 'patch', 'head', 'delete'];

for (const x of helpers) {
  (get as any)[x] = (url: string, opts: any) =>
    get(url, Object.assign({}, opts, { method: x.toUpperCase() }));
}

get.setAppMode = function setAppMode() {
  // no-op
};

get.setBaseUrl = (u: string) => {
  baseUrl = u;
};

export const api: GotApi = get as any;
export default api;
