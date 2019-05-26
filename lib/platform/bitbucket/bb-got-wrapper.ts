import got from 'got';
import utilgot from '../../util/got';
import URL from 'url';
import * as hostRules from '../../util/host-rules';
import { IGotApi, IGotApiOptions } from '../common';

const endpoint = 'https://api.bitbucket.org/';

async function get(path: string, options: IGotApiOptions & got.GotJSONOptions) {
  const url = URL.resolve(endpoint, path);
  const opts: IGotApiOptions & hostRules.HostRule & got.GotJSONOptions = {
    json: true,
    ...options,
  };
  opts.headers = {
    'user-agent': 'https://github.com/renovatebot/renovate',
    ...opts.headers,
  };
  const { username, password } = hostRules.find({ hostType: 'bitbucket', url });
  opts.auth = `${username}:${password}`;
  const res = await utilgot(url, opts);
  return res;
}

const helpers = ['get', 'post', 'put', 'patch', 'head', 'delete'];

export const api: IGotApi = {} as any;

for (const x of helpers) {
  (api as any)[x] = (url: string, opts: any) =>
    get(url, Object.assign({}, opts, { method: x.toUpperCase() }));
}

api.reset = function reset() {};

export default api;
