import URL from 'url';
import got from '../got';

export interface HttpOptions {
  baseUrl?: string;
  body?: any;
  headers?: {
    'accept-encoding'?: string;
  };
}

export interface HttpResponse<T = unknown> {
  body: string;
}

export class Http {
  readonly hostType: string;

  readonly options: HttpOptions;

  constructor(hostType: string, options?: HttpOptions) {
    this.hostType = hostType;
    this.options = options;
  }

  async get<T = unknown>(
    url: string | URL,
    options: HttpOptions = {}
  ): Promise<HttpResponse<T> | null> {
    const resolvedUrl = URL.resolve(options.baseUrl || '', url.toString());
    const combinedOptions = {
      ...this.options,
      hostType: this.hostType,
      ...options,
    };
    const res = await got(resolvedUrl, combinedOptions);
    if (!res) {
      return null;
    }
    return { body: res.body };
  }
}
