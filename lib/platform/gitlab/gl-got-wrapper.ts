import parseLinkHeader from 'parse-link-header';

import { IGotApi } from '../common';
import got from '../../util/got';

const hostType = 'gitlab';
let baseUrl = 'https://gitlab.com/api/v4/';

async function get(path: string, options: any) {
  const opts = {
    hostType,
    baseUrl,
    json: true,
    ...options,
  };

  const res = await got(path, opts);
  if (opts.paginate) {
    // Check if result is paginated
    try {
      const linkHeader = parseLinkHeader(res.headers.link as string);
      if (linkHeader && linkHeader.next) {
        res.body = res.body.concat((await get(linkHeader.next.url, opts)).body);
      }
    } catch (err) /* istanbul ignore next */ {
      logger.warn({ err }, 'Pagination error');
    }
  }
  return res;
}

const helpers = ['get', 'post', 'put', 'patch', 'head', 'delete'];

interface IGlGotApi
  extends IGotApi<{
    paginate?: boolean;
  }> {
  setBaseUrl(url: string): void;
}

export const api: IGlGotApi = {} as any;

for (const x of helpers) {
  (api as any)[x] = (url: string, opts: any) =>
    get(url, Object.assign({}, opts, { method: x.toUpperCase() }));
}

api.setBaseUrl = e => {
  baseUrl = e;
};

export default api;
