import got from './got';

export class Http {
  hostType: string;

  options: any;

  constructor(hostType: string, options?: any) {
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

  async get(url: string, options?: any): Promise<any> {
    const res = await got(url, this.combineOptions(options));
    return res;
  }
}
