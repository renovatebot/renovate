import { GotJSONOptions } from 'got';
import got from '../../util/got';
import { GotApi, GotApiOptions, GotResponse } from '../common';
import { HOST_TYPE_BITBUCKET } from '../../constants/host-types';

async function get(
  path: string,
  options: GotApiOptions & GotJSONOptions
): Promise<GotResponse> {
  const opts: GotApiOptions & GotJSONOptions = {
    json: true,
    hostType: HOST_TYPE_BITBUCKET,
    baseUrl: 'https://api.bitbucket.org/',
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
