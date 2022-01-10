import { PlatformId } from '../../constants';
import { resolveBaseUrl } from '../url';
import { Http, HttpOptions, HttpResponse, InternalHttpOptions } from '.';

let baseUrl: string;
export const setBaseUrl = (url: string): void => {
  baseUrl = url;
};

export class BitbucketServerHttp extends Http {
  constructor(options?: HttpOptions) {
    super(PlatformId.BitbucketServer, options);
  }

  protected override request<T>(
    path: string,
    options?: InternalHttpOptions
  ): Promise<HttpResponse<T>> {
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
