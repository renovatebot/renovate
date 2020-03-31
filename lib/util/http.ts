import got from './got';

export class Http {
  hostType: string;

  options: any;

  constructor(hostType: string, options?: any) {
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
