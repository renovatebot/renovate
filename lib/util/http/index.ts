import is from '@sindresorhus/is/dist';
import URL from 'url';
import got from '../got';

interface OutgoingHttpHeaders {
  [header: string]: number | string | string[] | undefined;
}

export interface HttpOptions {
  auth?: string;
  baseUrl?: string;
  headers?: OutgoingHttpHeaders;
  throwHttpErrors?: boolean;
  useCache?: boolean;
}

export interface HttpPostOptions extends HttpOptions {
  body: any;
}

interface InternalHttpOptions extends HttpOptions {
  json?: boolean;
  method?: 'get' | 'post';
}

export interface HttpResponse<T = unknown> {
  body: string;
  headers: any;
}

export interface HttpJsonResponse<T = unknown> extends HttpResponse {
  body: T;
}

export class Http {
  readonly hostType: string;

  readonly options: HttpOptions;

  constructor(hostType: string, options?: HttpOptions) {
    this.hostType = hostType;
    this.options = options;
  }

  private async request<T = unknown>(
    url: string | URL,
    options?: InternalHttpOptions
  ): Promise<HttpResponse<T> | null> {
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
    const res = await got(resolvedUrl, combinedOptions);
    return { body: res.body, headers: res.headers };
  }

  get<T = unknown>(
    url: string,
    options: HttpOptions = {}
  ): Promise<HttpResponse<T> | null> {
    return this.request(url, options);
  }

  async getJson<T = unknown>(
    url: string,
    options: HttpOptions = {}
  ): Promise<HttpJsonResponse> {
    const res = await this.request(url, options);
    const body = is.string(res.body) ? JSON.parse(res.body) : res.body;
    return { ...res, body };
  }

  async postJson<T = unknown>(
    url: string,
    options: HttpPostOptions
  ): Promise<HttpJsonResponse> {
    const res = await this.request(url, { ...options, method: 'post' });
    const body = is.string(res.body) ? JSON.parse(res.body) : res.body;
    return { ...res, body };
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
