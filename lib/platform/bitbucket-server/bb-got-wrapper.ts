import got, { GotJSONOptions, GotMethod } from '../../util/got';
import { GotApi, GotApiOptions, GotResponse } from '../common';
import { PLATFORM_TYPE_BITBUCKET_SERVER } from '../../constants/platforms';

const hostType = PLATFORM_TYPE_BITBUCKET_SERVER;
let baseUrl: string;

function get(path: string, options: GotApiOptions): Promise<GotResponse> {
  const opts: GotJSONOptions = {
    prefixUrl: baseUrl,
    json: options.body,
    headers: options.headers,
    ...options.options,
    responseType: 'json',
    method: options.method,
    context: { hostType, ...options.options?.context },
  };
  opts.headers = {
    ...opts.headers,
    'X-Atlassian-Token': 'no-check',
  };
  return got(path, opts);
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
