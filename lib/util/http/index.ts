import got from 'got';
import gotUtil from '../got';

interface GotOptions extends got.GotOptions<string | null> {
  json?: boolean;
  useCache?: boolean;
  hostType: string;
}

export interface HttpOptions extends got.GotOptions<string | null> {
  useCache?: boolean;
}

export interface HttpResponse<T = unknown> {
  body: T;
}

export class Http {
  readonly hostType: string;

  readonly options: HttpOptions;

  constructor(hostType: string, options?: HttpOptions) {
    this.hostType = hostType;
    this.options = options;
  }

  private combineOptions(options: HttpOptions): GotOptions {
    return {
      ...this.options,
      ...options,
      hostType: this.hostType,
    };
  }

  async get<T = unknown>(
    url: string | URL,
    options?: HttpOptions
  ): Promise<HttpResponse<T>> {
    const res = await gotUtil(url, this.combineOptions(options));
    return res;
  }
}
