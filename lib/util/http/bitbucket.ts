import { PlatformId } from '../../constants';
import { Http, HttpOptions, HttpResponse, InternalHttpOptions } from '.';

let baseUrl = 'https://api.bitbucket.org/';

export const setBaseUrl = (url: string): void => {
  baseUrl = url;
};

export class BitbucketHttp extends Http {
  constructor(options?: HttpOptions) {
    super(PlatformId.Bitbucket, options);
  }

  protected override request<T>(
    url: string | URL,
    options?: InternalHttpOptions
  ): Promise<HttpResponse<T> | null> {
    const opts = {
      baseUrl,
      ...options,
    };
    return super.request<T>(url, opts);
  }
}
