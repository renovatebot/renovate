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
}

export interface HttpJsonResponse extends HttpResponse {
  body: any;
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
    options: InternalHttpOptions = {}
  ): Promise<HttpResponse<T> | null> {
    let resolvedUrl = url.toString();
    if (options.baseUrl) {
      resolvedUrl = URL.resolve(options.baseUrl, resolvedUrl);
    }
    const combinedOptions = {
      method: 'get',
      ...this.options,
      hostType: this.hostType,
      ...options,
    };
    const res = await got(resolvedUrl, combinedOptions);
    return { body: res.body };
  }

  get<T = unknown>(
    url: string | URL,
    options: HttpOptions = {}
  ): Promise<HttpResponse<T> | null> {
    return this.request(url, options);
  }

  async getJson<T = unknown>(
    url: string | URL,
    options: HttpOptions = {}
  ): Promise<HttpJsonResponse> {
    const res = await this.request(url, options);
    const body = is.string(res.body) ? JSON.parse(res.body) : res.body;
    return { body };
  }

  async postJson<T = unknown>(
    url: string | URL,
    options: HttpPostOptions
  ): Promise<HttpJsonResponse> {
    const res = await this.request(url, { ...options, method: 'post' });
    const body = is.string(res.body) ? JSON.parse(res.body) : res.body;
    return { body };
  }
}
