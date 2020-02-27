import parseLinkHeader from 'parse-link-header';
import { GotApi, GotResponse, GotApiOptions } from '../common';
import got, { GotJSONOptions, GotMethod } from '../../util/got';
import { logger } from '../../logger';
import { PLATFORM_FAILURE } from '../../constants/error-messages';
import { PLATFORM_TYPE_GITLAB } from '../../constants/platforms';

const hostType = PLATFORM_TYPE_GITLAB;
let baseUrl = 'https://gitlab.com/api/v4/';

async function get(path: string, options: GotApiOptions): Promise<GotResponse> {
  const opts: GotJSONOptions = {
    prefixUrl: baseUrl,
    json: options.body,
    headers: options.headers,
    method: options.method,
    ...options.options,
    responseType: 'json',
    context: { hostType, ...options.options?.context },
  };
  try {
    const res = await got<unknown[]>(path, opts);
    if (options.paginate) {
      // Check if result is paginated
      try {
        const linkHeader = parseLinkHeader(res.headers.link as string);
        if (linkHeader && linkHeader.next) {
          res.body = res.body.concat(
            (await get(linkHeader.next.url, options)).body
          );
        }
      } catch (err) /* istanbul ignore next */ {
        logger.warn({ err }, 'Pagination error');
      }
    }
    return res;
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode >= 500 && err.statusCode < 600) {
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

const helpers: GotMethod[] = ['get', 'post', 'put', 'patch', 'head', 'delete'];

export const api: GotApi = {} as any;

for (const method of helpers) {
  (api as any)[method] = (url: string, opts: any): Promise<GotResponse> =>
    get(url, { ...opts, method });
}

// eslint-disable-next-line @typescript-eslint/unbound-method
api.setBaseUrl = (e: string): void => {
  baseUrl = e;
};

export default api;
