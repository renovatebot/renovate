import { GotJSONOptions, Response } from 'got';
import URL from 'url';
import got from '../../util/got';
import { IGotApi, IGotApiOptions } from '../common';

let cache: Renovate.IDict<Response<any>> = {};

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
  const method = (
    opts.method || /* istanbul ignore next */ 'get'
  ).toLowerCase();
  if (method === 'get' && opts.useCache !== false && cache[path]) {
    logger.trace({ path }, 'Returning cached result');
    return cache[path];
  }
  delete opts.useCache;
  opts.headers = {
    'user-agent': 'https://github.com/renovatebot/renovate',
    'X-Atlassian-Token': 'no-check',
    ...opts.headers,
  };
  const { username, password } = hostRules.find({ hostType, url });
  opts.auth = `${username}:${password}`;
  const res = await got(url, opts);
  // logger.debug(res.body);
  if (method.toLowerCase() === 'get') {
    cache[path] = res;
  }
  return res;
}

const helpers = ['get', 'post', 'put', 'patch', 'head', 'delete'];

export const api: IGotApi = {} as any;

for (const x of helpers) {
  (api as any)[x] = (url: string, opts: any) =>
    get(url, Object.assign({}, opts, { method: x.toUpperCase() }));
}

api.reset = function reset() {
  cache = {};
};

api.setEndpoint = (e: string) => {
  endpoint = e;
};

export default api;
