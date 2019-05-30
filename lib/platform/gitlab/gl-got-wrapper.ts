import { IGotApi } from '../common';
import got from '../../util/got';

const hostType = 'gitlab';
let baseUrl = 'https://gitlab.com/api/v4/';

function get(path: string, options: any) {
  return got(path, {
    hostType,
    baseUrl,
    json: true,
    ...options,
  });
}

const helpers = ['get', 'post', 'put', 'patch', 'head', 'delete'];

interface IGlGotApi
  extends IGotApi<{
    paginate?: boolean;
  }> {
  setBaseUrl(url: string): void;
}

export const api: IGlGotApi = {} as any;

for (const x of helpers) {
  (api as any)[x] = (url: string, opts: any) =>
    get(url, Object.assign({}, opts, { method: x.toUpperCase() }));
}

api.setBaseUrl = e => {
  baseUrl = e;
};

export default api;
