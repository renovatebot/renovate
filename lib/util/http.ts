import got from './got';

export interface HttpOptions {
  dummy?: any; // to be defined
}

export interface HttpResponse<T = unknown> {
  body: T;
}

interface GotOptions extends HttpOptions {
  json: true;
  hostType: string;
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
      json: true,
      ...this.options,
      options,
      hostType: this.hostType,
    };
  }

  async get<T = unknown>(url: string, options?: HttpOptions): Promise<HttpResponse<T>> {
    const res = await got<T>(url, this.combineOptions(options));
    return res;
  }
}
