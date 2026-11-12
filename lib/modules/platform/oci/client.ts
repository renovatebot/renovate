import { randomUUID } from 'node:crypto';
import { isString } from '@sindresorhus/is';
import type { Hooks } from 'got';
import type { AuthenticationDetailsProvider, HttpRequest } from 'oci-common';
import { DefaultRequestSigner } from 'oci-common';
import { logger } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { Http, HttpError } from '../../../util/http/index.ts';
import type { HttpOptions, HttpResponse } from '../../../util/http/types.ts';

class OciHttp extends Http {
  protected override handleError(
    _url: string | URL,
    _options: HttpOptions,
    err: Error,
  ): never {
    if (err instanceof HttpError && err.response) {
      const { statusCode, headers } = err.response;
      logger.warn(
        { statusCode, opcRequestId: headers['opc-request-id'] },
        'OCI API request failed; check IAM permissions and project notification setup, and retain the request ID for Oracle Support',
      );
      if (statusCode === 429 || statusCode >= 500) {
        throw new ExternalHostError(err, 'oci');
      }
    }
    throw err;
  }
}

export class OciClient {
  private readonly http: Http;
  readonly endpoint: string;

  constructor(
    endpoint: string,
    authenticationProvider: AuthenticationDetailsProvider,
  ) {
    this.endpoint = endpoint;
    const signer = new DefaultRequestSigner(authenticationProvider);
    const hooks: Pick<Hooks, 'beforeRequest'> = {
      beforeRequest: [
        async (options) => {
          const request: HttpRequest = {
            uri: options.url!.toString(),
            method: options.method as HttpRequest['method'],
            headers: new Headers(),
            body: options.body,
          };
          // Sign the final URL and serialized body, including on retries.
          await signer.signHttpRequest(request);
          Object.assign(options.headers, Object.fromEntries(request.headers));
        },
      ],
    };
    const options = {
      noAuth: true,
      memCache: false,
      // A redirect would invalidate the signature and could disclose credentials.
      followRedirect: false,
      hooks,
    };
    this.http = new OciHttp('oci', options);
  }

  async get<T>(path: string, options?: HttpOptions): Promise<HttpResponse<T>> {
    const response = await this.http.getJsonUnchecked<T>(
      `${this.endpoint}${path}`,
      options,
    );
    // Missing files need non-throwing responses, but outages must still abort the run.
    if (response.statusCode === 429 || response.statusCode >= 500) {
      const requestId = response.headers['opc-request-id'];
      logger.warn(
        { statusCode: response.statusCode, opcRequestId: requestId },
        'OCI API lookup failed',
      );
      throw new ExternalHostError(
        new Error(
          `OCI API lookup failed (${response.statusCode}); request ID: ${isString(requestId) ? requestId : 'unavailable'}`,
        ),
        'oci',
      );
    }
    return response;
  }

  post<T>(path: string, body?: object): Promise<HttpResponse<T>> {
    return this.http.postJson<T>(`${this.endpoint}${path}`, {
      body,
      headers: { 'opc-retry-token': randomUUID() },
    });
  }

  put<T>(path: string, body: object): Promise<HttpResponse<T>> {
    return this.http.putJson<T>(`${this.endpoint}${path}`, { body });
  }

  async delete(path: string): Promise<void> {
    await this.http.deleteJson(`${this.endpoint}${path}`);
  }

  async getText(path: string, options?: HttpOptions): Promise<string> {
    return (await this.http.getText(`${this.endpoint}${path}`, options)).body;
  }

  async list<T>(path: string, query: Record<string, string>): Promise<T[]> {
    const items: T[] = [];
    const params = new URLSearchParams(query);
    const seenPages = new Set<string>();
    let page: string | undefined;
    do {
      if (page) {
        if (seenPages.has(page)) {
          throw new Error('OCI pagination returned a repeated page token');
        }
        seenPages.add(page);
        params.set('page', page);
      }
      const response = await this.get<{ items: T[] }>(`${path}?${params}`);
      items.push(...response.body.items);
      page = response.headers['opc-next-page'] as string | undefined;
    } while (page);
    return items;
  }
}
