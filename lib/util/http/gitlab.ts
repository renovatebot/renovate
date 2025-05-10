import is from '@sindresorhus/is';
import { RequestError, type RetryObject } from 'got';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import { getEnv } from '../env';
import { parseLinkHeader, parseUrl } from '../url';
import { HttpBase, type InternalJsonUnsafeOptions } from './http';
import type { HttpMethod, HttpOptions, HttpResponse } from './types';

let baseUrl = 'https://gitlab.com/api/v4/';
export const setBaseUrl = (url: string): void => {
  baseUrl = url;
};

export interface GitlabHttpOptions extends HttpOptions {
  paginate?: boolean;
}

export class GitlabHttp extends HttpBase<GitlabHttpOptions> {
  protected override get baseUrl(): string | undefined {
    return baseUrl;
  }

  constructor(type = 'gitlab', options?: GitlabHttpOptions) {
    super(type, options);
  }

  protected override async requestJsonUnsafe<T = unknown>(
    method: HttpMethod,
    options: InternalJsonUnsafeOptions<GitlabHttpOptions>,
  ): Promise<HttpResponse<T>> {
    const resolvedUrl = this.resolveUrl(options.url, options.httpOptions);
    const opts = {
      ...options,
      url: resolvedUrl,
    };
    opts.httpOptions ??= {};
    opts.httpOptions.throwHttpErrors = true;

    const result = await super.requestJsonUnsafe<T>(method, opts);
    if (opts.httpOptions.paginate && is.array(result.body)) {
      delete opts.httpOptions.cacheProvider;
      opts.httpOptions.memCache = false;

      // Check if result is paginated
      try {
        const linkHeader = parseLinkHeader(result.headers.link);
        const nextUrl = linkHeader?.next?.url
          ? parseUrl(linkHeader.next.url)
          : null;
        if (nextUrl) {
          if (getEnv().GITLAB_IGNORE_REPO_URL) {
            const defaultEndpoint = new URL(baseUrl);
            nextUrl.protocol = defaultEndpoint.protocol;
            nextUrl.host = defaultEndpoint.host;
          }

          opts.url = nextUrl;

          const nextResult = await this.requestJsonUnsafe<T>(method, opts);
          if (is.array(nextResult.body)) {
            result.body.push(...nextResult.body);
          }
        }
      } catch (err) {
        logger.warn({ err }, 'Pagination error');
      }
    }
    return result;
  }

  protected override handleError(
    url: string | URL,
    _httpOptions: HttpOptions,
    err: Error,
  ): never {
    if (err instanceof RequestError && err.response?.statusCode) {
      if (err.response.statusCode === 404) {
        logger.trace({ err }, 'GitLab 404');
        logger.debug({ url }, 'GitLab API 404');
        throw err;
      }
      logger.debug({ err }, 'Gitlab API error');
      if (
        err.response.statusCode === 429 ||
        (err.response.statusCode >= 500 && err.response.statusCode < 600)
      ) {
        throw new ExternalHostError(err, 'gitlab');
      }
    }
    const platformFailureCodes = [
      'EAI_AGAIN',
      'ECONNRESET',
      'ETIMEDOUT',
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    ];
    // TODO: fix test, should be `RequestError`
    if (
      'code' in err &&
      is.string(err.code) &&
      platformFailureCodes.includes(err.code)
    ) {
      throw new ExternalHostError(err, 'gitlab');
    }
    if (err.name === 'ParseError') {
      throw new ExternalHostError(err, 'gitlab');
    }
    throw err;
  }

  protected override calculateRetryDelay(retryObject: RetryObject): number {
    const { error, attemptCount, retryOptions } = retryObject;
    if (
      attemptCount <= retryOptions.limit &&
      error.options.method === 'POST' &&
      error.response?.statusCode === 409 &&
      error.response.rawBody.toString().includes('Resource lock')
    ) {
      const noise = Math.random() * 100;
      return 2 ** (attemptCount - 1) * 1000 + noise;
    }

    return super.calculateRetryDelay(retryObject);
  }
}
