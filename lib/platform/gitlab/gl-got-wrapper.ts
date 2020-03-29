import parseLinkHeader from 'parse-link-header';

import { GotApi, GotResponse } from '../common';
import got from '../../util/got';
import { logger } from '../../logger';
import { PLATFORM_FAILURE } from '../../constants/error-messages';
import { PLATFORM_TYPE_GITLAB } from '../../constants/platforms';

const hostType = PLATFORM_TYPE_GITLAB;
let baseUrl = 'https://gitlab.com/api/v4/';

async function get(path: string, options: any): Promise<GotResponse> {
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
    if (
      err.statusCode === 429 ||
      (err.statusCode >= 500 && err.statusCode < 600)
    ) {
      throw new Error(PLATFORM_FAILURE);
    }
    const platformFailureCodes = [
      'EAI_AGAIN',
      'ECONNRESET',
      'ETIMEDOUT',
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    ];
    if (platformFailureCodes.includes(err.code)) {
      throw new Error(PLATFORM_FAILURE);
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
  (api as any)[x] = (url: string, opts: any): Promise<GotResponse> =>
    get(url, { ...opts, method: x.toUpperCase() });
}

// eslint-disable-next-line @typescript-eslint/unbound-method
api.setBaseUrl = (e: string): void => {
  baseUrl = e;
};

export default api;
