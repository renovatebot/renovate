import got, { GotJSONOptions, GotMethod } from '../../util/got';
import { GotApi, GotApiOptions, GotResponse } from '../common';
import { PLATFORM_TYPE_BITBUCKET } from '../../constants/platforms';

const hostType = PLATFORM_TYPE_BITBUCKET;

async function get(
  path: string,
  options: BitBucketApiOptions
): Promise<GotResponse> {
  const opts: GotJSONOptions = {
    prefixUrl: 'https://api.bitbucket.org/',
    json: options.body,
    headers: options.headers,
    ...options.options,
    responseType: 'json',
    method: options.method,
    context: { hostType, ...options.options?.context },
  };

  // response expected as string
  if (options.json === false) (opts as any).responseType = 'text';
  const res = await got(path, opts);
  return res;
}

const helpers: GotMethod[] = ['get', 'post', 'put', 'patch', 'head', 'delete'];

export interface BitBucketApiOptions extends GotApiOptions {
  /**
   * response should be string instead of json
   */
  json?: false;
}

export const api: GotApi<BitBucketApiOptions> = {} as any;

for (const method of helpers) {
  (api as any)[method] = (url: string, opts: any): Promise<GotResponse> =>
    get(url, { ...opts, method });
}

export default api;
