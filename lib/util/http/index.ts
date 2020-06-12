import crypto from 'crypto';
import URL from 'url';
import { GotPromise } from 'got';
import * as runCache from '../cache/run';
import { clone } from '../clone';
import got from '../got';

interface OutgoingHttpHeaders {
  [header: string]: number | string | string[] | undefined;
}

export interface HttpOptions {
  body?: any;
  auth?: string;
  baseUrl?: string;
  headers?: OutgoingHttpHeaders;
  throwHttpErrors?: boolean;
  useCache?: boolean;
}

export interface HttpPostOptions extends HttpOptions {
  body: unknown;
}

export interface InternalHttpOptions extends HttpOptions {
  json?: boolean;
  method?: 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head';
}

export interface HttpResponse<T = string> {
  body: T;
  headers: any;
}

function cloneResponse(response: any): any {
  // clone body and headers so that the cached result doesn't get accidentally mutated
  return {
    body: clone(response.body),
    headers: clone(response.headers),
  };
}

export class Http<GetOptions = HttpOptions, PostOptions = HttpPostOptions> {
  constructor(private hostType: string, private options?: HttpOptions) {}

  protected async request<T>(
    url: string | URL,
    httpOpts?: InternalHttpOptions
  ): Promise<HttpResponse<T> | null> {
    const options = { ...httpOpts };
    let resolvedUrl = url.toString();
    if (options?.baseUrl) {
      resolvedUrl = URL.resolve(options.baseUrl, resolvedUrl);
    }
    // TODO: deep merge in order to merge headers
    const combinedOptions: any = {
      method: 'get',
      ...this.options,
      hostType: this.hostType,
      ...options,
    };
    combinedOptions.hooks = {
      beforeRedirect: [
        (opts: any): void => {
          // Check if request has been redirected to Amazon
          if (opts.search?.includes('X-Amz-Algorithm')) {
            // if there is no port in the redirect URL string, then delete it from the redirect options.
            // This can be evaluated for removal after upgrading to Got v10
            const portInUrl = opts.href.split('/')[2].split(':')[1];
            if (!portInUrl) {
              // eslint-disable-next-line no-param-reassign
              delete opts.port; // Redirect will instead use 80 or 443 for HTTP or HTTPS respectively
            }

            // registry is hosted on amazon, redirect url includes authentication.
            delete opts.headers.authorization; // eslint-disable-line no-param-reassign
            delete opts.auth; // eslint-disable-line no-param-reassign
          }
        },
      ],
    };
    combinedOptions.headers = {
      ...combinedOptions.headers,
      'user-agent':
        process.env.RENOVATE_USER_AGENT ||
        'https://github.com/renovatebot/renovate',
    };

    // Cache GET requests unless useCache=false
    let promisedRes: GotPromise<any>;
    if (combinedOptions.method === 'get') {
      const cacheKey = crypto
        .createHash('md5')
        .update(
          'got-' +
            JSON.stringify({ url: resolvedUrl, headers: options.headers })
        )
        .digest('hex');
      if (combinedOptions.useCache !== false) {
        // check cache unless bypassing it
        promisedRes = runCache.get(cacheKey);
      }
      if (promisedRes === undefined) {
        // cache miss OR cache bypass
        promisedRes = got(resolvedUrl, combinedOptions);
      }
      runCache.set(cacheKey, promisedRes); // always set
      return cloneResponse(await promisedRes);
    }
    return cloneResponse(await got(resolvedUrl, combinedOptions));
  }

  get(url: string, options: HttpOptions = {}): Promise<HttpResponse> {
    return this.request<string>(url, options);
  }

  head(url: string, options: HttpOptions = {}): Promise<HttpResponse> {
    return this.request<string>(url, { ...options, method: 'head' });
  }

  private async requestJson<T = unknown>(
    url: string,
    options: InternalHttpOptions
  ): Promise<HttpResponse<T>> {
    const res = await this.request<T>(url, { ...options, json: true });
    const body = res.body;
    return { ...res, body };
  }

  async getJson<T = unknown>(
    url: string,
    options?: GetOptions
  ): Promise<HttpResponse<T>> {
    return this.requestJson<T>(url, { ...options });
  }

  async headJson<T = unknown>(
    url: string,
    options?: GetOptions
  ): Promise<HttpResponse<T>> {
    return this.requestJson<T>(url, { ...options, method: 'head' });
  }

  async postJson<T = unknown>(
    url: string,
    options?: PostOptions
  ): Promise<HttpResponse<T>> {
    return this.requestJson<T>(url, { ...options, method: 'post' });
  }

  async putJson<T = unknown>(
    url: string,
    options?: PostOptions
  ): Promise<HttpResponse<T>> {
    return this.requestJson<T>(url, { ...options, method: 'put' });
  }

  async patchJson<T = unknown>(
    url: string,
    options?: PostOptions
  ): Promise<HttpResponse<T>> {
    return this.requestJson<T>(url, { ...options, method: 'patch' });
  }

  async deleteJson<T = unknown>(
    url: string,
    options?: PostOptions
  ): Promise<HttpResponse<T>> {
    return this.requestJson<T>(url, { ...options, method: 'delete' });
  }

  stream(url: string, options?: HttpOptions): NodeJS.ReadableStream {
    const combinedOptions: any = {
      method: 'get',
      ...this.options,
      hostType: this.hostType,
      ...options,
    };
    return got.stream(url, combinedOptions);
  }
}
