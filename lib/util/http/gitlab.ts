import { isArray, isString } from '@sindresorhus/is';
import { RequestError, type RetryObject } from 'got';
import { logger } from '../../logger/index.ts';
import { ExternalHostError } from '../../types/errors/external-host-error.ts';
import { getEnv } from '../env.ts';
import { parseLinkHeader, parseUrl } from '../url.ts';
import { HttpBase, type InternalJsonUnsafeOptions } from './http.ts';
import type { HttpMethod, HttpOptions, HttpResponse } from './types.ts';

let baseUrl = 'https://gitlab.com/api/v4/';
export function setBaseUrl(url: string): void {
  baseUrl = url;
}

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

  protected override extraOptions(): readonly string[] {
    return super
      .extraOptions()
      .concat(['paginate'] as (keyof GitlabHttpOptions)[]);
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
    if (opts.httpOptions.paginate && isArray(result.body)) {
      opts.httpOptions.memCache = false;

      // Check if result is paginated
      try {
        const linkHeader = parseLinkHeader(result.headers.link);
        const nextUrl = linkHeader?.next?.url
          ? parseUrl(linkHeader.next.url)
          : null;
        if (nextUrl) {
          if (getEnv().GITLAB_IGNORE_REPO_URL) {
            const defaultEndpoint = parseUrl(baseUrl)!;
            nextUrl.protocol = defaultEndpoint.protocol;
            nextUrl.host = defaultEndpoint.host;
          }

          opts.url = nextUrl;

          const nextResult = await this.requestJsonUnsafe<T>(method, opts);
          // v8 ignore else -- TODO: add test #40625
          if (isArray(nextResult.body)) {
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
      isString(err.code) &&
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
      isRetryablePostError(error)
    ) {
      const noise = Math.random() * 100;
      return 2 ** (attemptCount - 1) * 1000 + noise;
    }

    return super.calculateRetryDelay(retryObject);
  }
}

/**
 * Detects transient GitLab errors on POST requests that are safe to retry:
 *
 * - `409` with a `Resource lock` message, which happens when concurrent
 *   requests conflict.
 * - `400` with a `source_branch does not exist` message, which happens when a
 *   freshly pushed branch is not yet visible to the API due to Gitaly eventual
 *   consistency.
 */
function isRetryablePostError(error: RequestError): boolean {
  const { response } = error;
  if (response?.statusCode === 409) {
    return response.rawBody.toString().includes('Resource lock');
  }

  if (response?.statusCode === 400) {
    const rawBody = response.rawBody.toString();
    return (
      rawBody.includes('source_branch') && rawBody.includes('does not exist')
    );
  }

  return false;
}
