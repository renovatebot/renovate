import { URL } from 'url';
import { PLATFORM_TYPE_GITEA } from '../../constants/platforms';
import got from '../../util/got';
import { GotApi, GotApiOptions, GotResponse } from '../common';

const hostType = PLATFORM_TYPE_GITEA;
let baseUrl: string;

function getPaginationContainer(body: any): any[] {
  if (Array.isArray(body) && body.length) {
    return body;
  }
  if (Array.isArray(body?.data) && body.data.length) {
    return body.data;
  }

  return null;
}

async function get(path: string, options?: any): Promise<GotResponse> {
  const opts = {
    hostType,
    baseUrl,
    json: true,
    ...options,
  };

  const res = await got(path, opts);
  const pc = getPaginationContainer(res.body);
  if (opts.paginate && pc) {
    const url = new URL(res.url);
    const total = parseInt(res.headers['x-total-count'] as string, 10);
    let nextPage = parseInt(url.searchParams.get('page') || '1', 10);

    while (total && pc.length < total) {
      nextPage += 1;
      url.searchParams.set('page', nextPage.toString());

      const nextRes = await got(url.toString(), opts);
      pc.push(...getPaginationContainer(nextRes.body));
    }
  }

  return res;
}

const helpers = ['get', 'post', 'put', 'patch', 'head', 'delete'];

export type GiteaGotOptions = {
  paginate?: boolean;
  token?: string;
} & GotApiOptions;

export interface GiteaGotApi extends GotApi<GiteaGotOptions> {
  setBaseUrl(url: string): void;
}

export const api: GiteaGotApi = {} as any;

for (const x of helpers) {
  (api as any)[x] = (path: string, options: any): Promise<GotResponse> =>
    get(path, { ...options, method: x.toUpperCase() });
}

// eslint-disable-next-line @typescript-eslint/unbound-method
api.setBaseUrl = (e: string): void => {
  baseUrl = e;
};
