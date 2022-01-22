import { PlatformId } from '../../constants';
import { Http, HttpOptions, HttpResponse, InternalHttpOptions } from '.';

let baseUrl = 'https://api.bitbucket.org/';

export const setBaseUrl = (url: string): void => {
  baseUrl = url;
};

export class BitbucketHttp extends Http {
  constructor(type: string = PlatformId.Bitbucket, options?: HttpOptions) {
    super(type, options);
  }

  protected override request<T>(
    url: string | URL,
    options?: InternalHttpOptions
  ): Promise<HttpResponse<T>> {
    const opts = { baseUrl, ...options };
    return super.request<T>(url, opts);
  }
}
