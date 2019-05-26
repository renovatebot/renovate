import { GotJSONOptions, Response } from 'got';
import URL from 'url';
import got from '../../util/got';
import { IGotApi, IGotApiOptions } from '../common';

const hostType = 'bitbucket-server';
let endpoint: string;

async function get(path: string, options: IGotApiOptions & GotJSONOptions) {
  const url = URL.resolve(endpoint, path);
  const opts: IGotApiOptions & hostRules.HostRule & GotJSONOptions = {
    // TODO: Move to configurable host rules, or use utils/got
    timeout: 60 * 1000,
    json: true,
    ...options,
  };
  opts.headers = {
    'user-agent': 'https://github.com/renovatebot/renovate',
    'X-Atlassian-Token': 'no-check',
    ...opts.headers,
  };
  opts.hostType = 'bitbucket-server';
  const res = await got(url, opts);
  return res;
}

const helpers = ['get', 'post', 'put', 'patch', 'head', 'delete'];

export const api: IGotApi = {} as any;

for (const x of helpers) {
  (api as any)[x] = (url: string, opts: any) =>
    get(url, Object.assign({}, opts, { method: x.toUpperCase() }));
}

api.setEndpoint = (e: string) => {
  endpoint = e;
};

export default api;
