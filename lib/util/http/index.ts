import { GotOptions } from 'got';
import got from '../got';

export interface HttpOptions extends GotOptions<string | null> {
  useCache?: boolean;
}

export class Http {
  hostType: string;

  options: GotOptions<string | null>;

  constructor(hostType: string, options?: HttpOptions) {
    this.hostType = hostType;
    this.options = options;
  }

  combineOptions(options: any): any {
    return {
      json: true,
      ...this.options,
      options,
      hostType: this.hostType,
    };
  }

  async get(url: string, options?: HttpOptions): Promise<any> {
    const res = await got(url, this.combineOptions(options));
    return res;
  }
}
