import type {
  HttpOptions,
  HttpRequestOptions,
  HttpResponse,
  InternalHttpOptions,
} from './types';
import { Http } from '.';

let baseUrl: string;

export const setBaseUrl = (url: string): void => {
  baseUrl = url;
};

export class JiraHttp extends Http {
  constructor(type = 'jira', options?: HttpOptions) {
    super(type, options);
  }

  protected override request<T>(
    url: string | URL,
    options?: InternalHttpOptions & HttpRequestOptions<T>,
  ): Promise<HttpResponse<T>> {
    const opts = { baseUrl, ...options };
    return super.request<T>(url, opts);
  }
}
