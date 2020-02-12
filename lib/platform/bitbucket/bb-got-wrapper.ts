import got, { GotJSONOptions } from '../../util/got';
import { GotApi, GotApiOptions, GotResponse } from '../common';
import { PLATFORM_TYPE_BITBUCKET } from '../../constants/platforms';

async function get(
  path: string,
  options: GotApiOptions & GotJSONOptions
): Promise<GotResponse> {
  const opts: GotApiOptions & GotJSONOptions = {
    responseType: 'json',
    hostType: PLATFORM_TYPE_BITBUCKET,
    prefixUrl: 'https://api.bitbucket.org/',
    ...options,
  };
  const res = await got(path, opts);
  return res;
}

const helpers = ['get', 'post', 'put', 'patch', 'head', 'delete'];

export const api: GotApi = {} as any;

for (const x of helpers) {
  (api as any)[x] = (url: string, opts: any): Promise<GotResponse> =>
    get(url, { ...opts, method: x.toUpperCase() });
}

export default api;
