import { GotJSONOptions } from 'got';
import got from '../../util/got';
import { IGotApi, IGotApiOptions } from '../common';

let baseUrl: string;

function get(path: string, options: IGotApiOptions & GotJSONOptions) {
  const opts: IGotApiOptions & GotJSONOptions = {
    ...options,
    hostType: 'bitbucket-server',
    baseUrl,
    json: true,
  };
  opts.headers = {
    ...opts.headers,
    'X-Atlassian-Token': 'no-check',
  };
  return got(path, opts);
}

const helpers = ['get', 'post', 'put', 'patch', 'head', 'delete'];

export const api: IGotApi = {} as any;

for (const x of helpers) {
  (api as any)[x] = (url: string, opts: any) =>
    get(url, Object.assign({}, opts, { method: x.toUpperCase() }));
}

api.setBaseUrl = (e: string) => {
  baseUrl = e;
};

export default api;
