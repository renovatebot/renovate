import got from 'got';
import URL from 'url';
import * as hostRules from '../../util/host-rules';
import { IGotApi, IGotApiOptions } from '../common';

let cache: Renovate.IDict<got.Response<any>> = {};

const endpoint = 'https://api.bitbucket.org/';

async function get(path: string, options: IGotApiOptions & got.GotJSONOptions) {
  const url = URL.resolve(endpoint, path);
  const opts: IGotApiOptions & hostRules.HostRule & got.GotJSONOptions = {
    // TODO: Move to configurable host rules, or use utils/got
    timeout: 60 * 1000,
    json: true,
    ...hostRules.find({ hostType: 'bitbucket', url }),
    ...options,
  };
  const method = (
    opts.method || /* istanbul ignore next */ 'get'
  ).toLowerCase();
  if (method === 'get' && cache[path]) {
    logger.trace({ path }, 'Returning cached result');
    return cache[path];
  }
  opts.headers = {
    'user-agent': 'https://github.com/renovatebot/renovate',
    authorization: opts.token
      ? `Basic ${opts.token}`
      : /* istanbul ignore next */ undefined,
    ...opts.headers,
  };

  const res = await got(url, opts);
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

export default api;
