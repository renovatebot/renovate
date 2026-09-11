import {
  isNonEmptyObject,
  isNullOrUndefined,
  isString,
} from '@sindresorhus/is';
import { RequestError } from 'got';
import { DateTime } from 'luxon';
import { z } from 'zod/v4';
import { logger } from '../../logger/index.ts';
import type { PagedResult } from '../../modules/platform/bitbucket/types.ts';
import { regEx } from '../regex.ts';
import { Json } from '../schema-utils/index.ts';
import { parseLinkHeader } from '../url.ts';
import { HttpBase, type InternalJsonUnsafeOptions } from './http.ts';
import type { HttpMethod, HttpOptions, HttpResponse } from './types.ts';

const MAX_PAGES = 100;
const MAX_PAGELEN = 100;

let baseUrl = 'https://api.bitbucket.org/';

export function setBaseUrl(url: string): void {
  baseUrl = url;
}

export interface BitbucketHttpOptions extends HttpOptions {
  paginate?: boolean;
  pagelen?: number;
}

export class BitbucketHttp extends HttpBase<BitbucketHttpOptions> {
  protected override get baseUrl(): string | undefined {
    return baseUrl;
  }

  constructor(type = 'bitbucket', options?: BitbucketHttpOptions) {
    super(type, options);
  }

  protected override extraOptions(): readonly string[] {
    return super
      .extraOptions()
      .concat(['paginate', 'pagelen'] as (keyof BitbucketHttpOptions)[]);
  }

  protected override handleError(
    url: string | URL,
    httpOptions: HttpOptions,
    err: Error,
  ): never {
    if (err instanceof RequestError && err.response) {
      const announcement = DeprecationAnnouncementBody.safeParse(
        err.response.body,
      );
      if (announcement.success) {
        const { message, detail, data } = announcement.data.error;
        logger.once.warn(
          {
            // `url` is only resolved against the base URL for JSON requests
            url: err.response.url,
            message,
            ...(detail && { detail }),
            announcementUrl: data.announcement_url,
          },
          'Bitbucket API functionality has been deprecated or removed',
        );
      }
    }
    return super.handleError(url, httpOptions, err);
  }

  protected override handleResponse(
    url: URL,
    res: HttpResponse<unknown>,
  ): void {
    const { deprecation, sunset, link } = res.headers;
    if (!isString(deprecation) && !isString(sunset)) {
      return;
    }

    const announcementUrl = parseLinkHeader(isString(link) ? link : undefined)
      ?.deprecation?.url;

    logger.once.warn(
      {
        url: url.toString(),
        ...(isString(deprecation) && { deprecation: formatDate(deprecation) }),
        ...(isString(sunset) && { sunset: formatDate(sunset) }),
        ...(announcementUrl && { announcementUrl }),
      },
      'Bitbucket API endpoint has been marked as deprecated',
    );
  }

  protected override async requestJsonUnsafe<T>(
    method: HttpMethod,
    options: InternalJsonUnsafeOptions<BitbucketHttpOptions>,
  ): Promise<HttpResponse<T>> {
    const resolvedUrl = this.resolveUrl(options.url, options.httpOptions);
    const opts: InternalJsonUnsafeOptions<BitbucketHttpOptions> = {
      ...options,
      url: resolvedUrl,
    };
    const paginate = opts.httpOptions?.paginate;

    if (paginate && !hasPagelen(resolvedUrl)) {
      const pagelen = opts.httpOptions!.pagelen ?? MAX_PAGELEN;
      resolvedUrl.searchParams.set('pagelen', pagelen.toString());
    }

    const result = await super.requestJsonUnsafe<T | PagedResult<T>>(
      method,
      opts,
    );

    if (paginate && isPagedResult(result.body)) {
      // v8 ignore else -- TODO: add test #40625
      if (opts.httpOptions) {
        opts.httpOptions.memCache = false;
      }
      const resultBody = result.body;
      let nextURL = result.body.next;
      let page = 1;

      for (; nextURL && page <= MAX_PAGES; page++) {
        opts.url = nextURL;
        const nextResult = await super.requestJsonUnsafe<PagedResult<T>>(
          method,
          opts,
        );

        resultBody.values.push(...nextResult.body.values);
        nextURL = nextResult.body.next;
      }

      // Override other page-related attributes
      resultBody.pagelen = resultBody.values.length;
      /* v8 ignore next -- hard to test all branches */
      resultBody.size =
        page <= MAX_PAGES ? resultBody.values.length : undefined;
      // v8 ignore next -- hard to test all branches
      resultBody.next = page <= MAX_PAGES ? nextURL : undefined;
    }

    return result as HttpResponse<T>;
  }
}

/**
 * Bitbucket Cloud responds with an error body linking to the relevant changelog entry when the endpoint's functionality has been deprecated or removed.
 *
 * See https://developer.atlassian.com/cloud/bitbucket/changelog/
 */
const DeprecationAnnouncement = z.object({
  error: z.object({
    message: z.string(),
    detail: z.string().optional(),
    data: z.object({
      announcement_url: z.string(),
    }),
  }),
});

/** The body is already parsed for JSON requests, but a raw string otherwise. */
const DeprecationAnnouncementBody = z.union([
  DeprecationAnnouncement,
  Json.pipe(DeprecationAnnouncement),
]);

/**
 * Format a `Deprecation` or `Sunset` header as ISO 8601, falling back to the raw value when it cannot be parsed.
 *
 * `Sunset` is an HTTP date, and `Deprecation` is either an HTTP date or an `@`-prefixed Unix timestamp.
 */
function formatDate(value: string): string {
  const seconds = regEx(/^@(?<seconds>\d+)$/).exec(value)?.groups?.seconds;
  if (seconds) {
    return (
      DateTime.fromSeconds(parseInt(seconds, 10), { zone: 'utc' }).toISO() ??
      value
    );
  }

  // Bitbucket Cloud sends `UTC` timezone, whereas RFC8594 requires `GMT`, so we can manually work around this to parse correctly
  const httpDate = value.replace(regEx(/ UTC$/), ' GMT');
  return DateTime.fromHTTP(httpDate, { zone: 'utc' }).toISO() ?? value;
}

function hasPagelen(url: URL): boolean {
  return !isNullOrUndefined(url.searchParams.get('pagelen'));
}

function isPagedResult<T>(obj: any): obj is PagedResult<T> {
  return isNonEmptyObject(obj) && Array.isArray(obj.values);
}
