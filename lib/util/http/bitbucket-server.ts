import { PLATFORM_TYPE_BITBUCKET_SERVER } from '../../constants/platforms';
import { resolveBaseUrl } from '../url';
import { Http, HttpOptions, HttpResponse, InternalHttpOptions } from '.';

let baseUrl: string;
export const setBaseUrl = (url: string): void => {
  baseUrl = url;
};

export class BitbucketServerHttp extends Http {
  constructor(options?: HttpOptions) {
    super(PLATFORM_TYPE_BITBUCKET_SERVER, options);
  }

  protected request<T>(
    path: string,
    options?: InternalHttpOptions
  ): Promise<HttpResponse<T> | null> {
    const url = resolveBaseUrl(baseUrl, path);
    const opts = {
      baseUrl,
      ...options,
    };
    opts.headers = {
      ...opts.headers,
      'X-Atlassian-Token': 'no-check',
    };
    return super.request<T>(url, opts);
  }
}
