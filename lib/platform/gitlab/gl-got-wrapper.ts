import parseLinkHeader from 'parse-link-header';

import { GotApi } from '../common';
import got from '../../util/got';
import { logger } from '../../logger';

const hostType = 'gitlab';
let baseUrl = 'https://gitlab.com/api/v4/';

async function get(path: string, options: any) {
  const opts = {
    hostType,
    baseUrl,
    json: true,
    ...options,
  };
  try {
    const res = await got(path, opts);
    if (opts.paginate) {
      // Check if result is paginated
      try {
        const linkHeader = parseLinkHeader(res.headers.link as string);
        if (linkHeader && linkHeader.next) {
          res.body = res.body.concat(
            (await get(linkHeader.next.url, opts)).body
          );
        }
      } catch (err) /* istanbul ignore next */ {
        logger.warn({ err }, 'Pagination error');
      }
    }
    return res;
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode >= 500 && err.statusCode < 600) {
      throw new Error('platform-failure');
    }
    if (
      err.code === 'ECONNRESET' ||
      err.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
    ) {
      throw new Error('platform-failure');
    }
    throw err;
  }
}

const helpers = ['get', 'post', 'put', 'patch', 'head', 'delete'];

interface GlGotApi
  extends GotApi<{
    paginate?: boolean;
    token?: string;
  }> {
  setBaseUrl(url: string): void;
}

export const api: GlGotApi = {} as any;

for (const x of helpers) {
  (api as any)[x] = (url: string, opts: any) =>
    get(url, Object.assign({}, opts, { method: x.toUpperCase() }));
}

api.setBaseUrl = e => {
  baseUrl = e;
};

export default api;
