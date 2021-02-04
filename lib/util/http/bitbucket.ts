import { PLATFORM_TYPE_BITBUCKET } from '../../constants/platforms';
import { Http, HttpOptions, HttpResponse, InternalHttpOptions } from '.';

export const bitbucketApiEndpoint = 'https://api.bitbucket.org/';
let baseUrl = bitbucketApiEndpoint;

export const setBaseUrl = (url: string): void => {
  baseUrl = url;
};

export class BitbucketHttp extends Http {
  constructor(options?: HttpOptions) {
    super(PLATFORM_TYPE_BITBUCKET, options);
  }

  protected request<T>(
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
