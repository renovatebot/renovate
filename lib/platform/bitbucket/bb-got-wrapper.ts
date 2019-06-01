import { GotJSONOptions } from 'got';
import got from '../../util/got';
import { IGotApi, IGotApiOptions } from '../common';

async function get(path: string, options: IGotApiOptions & GotJSONOptions) {
  const opts: IGotApiOptions & GotJSONOptions = {
    ...options,
    json: true,
    hostType: 'bitbucket',
    baseUrl: 'https://api.bitbucket.org/',
  };
  const res = await got(path, opts);
  return res;
}

const helpers = ['get', 'post', 'put', 'patch', 'head', 'delete'];

export const api: IGotApi = {} as any;

for (const x of helpers) {
  (api as any)[x] = (url: string, opts: any) =>
    get(url, Object.assign({}, opts, { method: x.toUpperCase() }));
}

export default api;
