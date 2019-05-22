import got from 'got';
import URL from 'url';
import * as hostRules from '../../util/host-rules';
import { IGotApiOptions, IGotApi } from '../common';

let cache: Renovate.IDict<got.Response<any>> = {};

const hostType = 'bitbucket-server';
let endpoint: string;

async function get(path: string, options: IGotApiOptions & got.GotJSONOptions) {
  const url = URL.resolve(endpoint, path);
  const opts: IGotApiOptions &
    hostRules.IPlatformConfig &
    got.GotJSONOptions = {
    // TODO: Move to configurable host rules, or use utils/got
    timeout: 60 * 1000,
    json: true,
    basic: false,
    ...hostRules.find({ hostType, url }),
    ...options,
  };
  const method = (
    opts.method || /* istanbul ignore next */ 'get'
  ).toLowerCase();
  const useCache = opts.useCache;
  if (method === 'get' && useCache !== false && cache[path]) {
    logger.trace({ path }, 'Returning cached result');
    return cache[path];
  }
  opts.headers = {
    'user-agent': 'https://github.com/renovatebot/renovate',
    'X-Atlassian-Token': 'no-check',

    authorization: opts.token
      ? /* istanbul ignore next */ `Basic ${opts.token}`
      : undefined,
    ...opts.headers,
  };

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
