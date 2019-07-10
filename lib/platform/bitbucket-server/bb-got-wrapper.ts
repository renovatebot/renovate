import URL from 'url';
import { GotJSONOptions } from 'got';
import got from '../../util/got';
import { GotApi, GotApiOptions } from '../common';

let baseUrl: string;

function get(path: string, options: GotApiOptions & GotJSONOptions) {
  const url = URL.resolve(baseUrl, path);
  const opts: GotApiOptions & GotJSONOptions = {
    hostType: 'bitbucket-server',
    json: true,
    ...options,
  };
  opts.headers = {
    ...opts.headers,
    'X-Atlassian-Token': 'no-check',
  };
  return got(url, opts);
}

const helpers = ['get', 'post', 'put', 'patch', 'head', 'delete'];

export const api: GotApi = {} as any;

for (const x of helpers) {
  (api as any)[x] = (url: string, opts: any) =>
    get(url, Object.assign({}, opts, { method: x.toUpperCase() }));
}

api.setBaseUrl = (e: string) => {
  baseUrl = e;
};

export default api;
