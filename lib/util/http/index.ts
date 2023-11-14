import merge from 'deepmerge';
import got, { Options, RequestError } from 'got';
import type { SetRequired } from 'type-fest';
import { infer as Infer, type ZodError, ZodType } from 'zod';
import { HOST_DISABLED } from '../../constants/error-messages';
import { pkg } from '../../expose.cjs';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as memCache from '../cache/memory';
import { clone } from '../clone';
import { hash } from '../hash';
import { type AsyncResult, Result } from '../result';
import { resolveBaseUrl } from '../url';
import { applyAuthorization, removeAuthorization } from './auth';
import { hooks } from './hooks';
import { applyHostRules } from './host-rules';
import { getQueue } from './queue';
import { Throttle, getThrottle } from './throttle';
import type {
  GotJSONOptions,
  GotOptions,
  GotTask,
  HttpOptions,
  HttpRequestOptions,
  HttpResponse,
  InternalHttpOptions,
  RequestStats,
} from './types';
// TODO: refactor code to remove this (#9651)
import './legacy';

export { RequestError as HttpError };

export class EmptyResultError extends Error {}
export type SafeJsonError = RequestError | ZodError | EmptyResultError;

type JsonArgs<
  Opts extends HttpOptions & HttpRequestOptions<ResT>,
  ResT = unknown,
  Schema extends ZodType<ResT> = ZodType<ResT>,
> = {
  url: string;
  httpOptions?: Opts;
  schema?: Schema;
};

// Copying will help to avoid circular structure
// and mutation of the cached response.
function copyResponse<T>(
  response: HttpResponse<T>,
  deep: boolean,
): HttpResponse<T> {
  const { body, statusCode, headers } = response;
  return deep
    ? {
        statusCode,
        body: body instanceof Buffer ? (body.subarray() as T) : clone<T>(body),
        headers: clone(headers),
      }
    : {
        statusCode,
        body,
        headers,
      };
}

function applyDefaultHeaders(options: Options): void {
  const renovateVersion = pkg.version;
  options.headers = {
    ...options.headers,
    'user-agent':
      process.env.RENOVATE_USER_AGENT ??
      `RenovateBot/${renovateVersion} (https://github.com/renovatebot/renovate)`,
  };
}

// Note on types:
// options.requestType can be either 'json' or 'buffer', but `T` should be
// `Buffer` in the latter case.
// We don't declare overload signatures because it's immediately wrapped by
// `request`.
async function gotTask<T>(
  url: string,
  options: SetRequired<GotOptions, 'method'>,
  requestStats: Omit<RequestStats, 'duration' | 'statusCode'>,
): Promise<HttpResponse<T>> {
  logger.trace({ url, options }, 'got request');

  let duration = 0;
  let statusCode = 0;

  try {
    // Cheat the TS compiler using `as` to pick a specific overload.
    // Otherwise it doesn't typecheck.
    const resp = await got<T>(url, { ...options, hooks } as GotJSONOptions);
    statusCode = resp.statusCode;
    duration =
      resp.timings.phases.total ??
      /* istanbul ignore next: can't be tested */ 0;
    return resp;
  } catch (error) {
    if (error instanceof RequestError) {
      statusCode =
        error.response?.statusCode ??
        /* istanbul ignore next: can't be tested */ -1;
      duration =
        error.timings?.phases.total ??
        /* istanbul ignore next: can't be tested */ -1;
      const method = options.method.toUpperCase();
      const code = error.code ?? /* istanbul ignore next */ 'UNKNOWN';
      const retryCount =
        error.request?.retryCount ?? /* istanbul ignore next */ -1;
      logger.debug(
        `${method} ${url} = (code=${code}, statusCode=${statusCode} retryCount=${retryCount}, duration=${duration})`,
      );
    }

    throw error;
  } finally {
    const httpRequests = memCache.get<RequestStats[]>('http-requests') || [];
    httpRequests.push({ ...requestStats, duration, statusCode });
    memCache.set('http-requests', httpRequests);
  }
}

export class Http<Opts extends HttpOptions = HttpOptions> {
  private options?: GotOptions;

  constructor(
    protected hostType: string,
    options: HttpOptions = {},
  ) {
    this.options = merge<GotOptions>(options, { context: { hostType } });

    if (process.env.NODE_ENV === 'test') {
      this.options.retry = 0;
    }
  }

  protected getThrottle(url: string): Throttle | null {
    return getThrottle(url);
  }

  protected async request<T>(
    requestUrl: string | URL,
    httpOptions: InternalHttpOptions & HttpRequestOptions<T>,
  ): Promise<HttpResponse<T>> {
    let url = requestUrl.toString();
    if (httpOptions?.baseUrl) {
      url = resolveBaseUrl(httpOptions.baseUrl, url);
    }

    let options = merge<SetRequired<GotOptions, 'method'>, GotOptions>(
      {
        method: 'get',
        ...this.options,
        hostType: this.hostType,
      },
      httpOptions,
    );

    const etagCache =
      httpOptions.etagCache && options.method === 'get'
        ? httpOptions.etagCache
        : null;
    if (etagCache) {
      options.headers = {
        ...options.headers,
        'If-None-Match': etagCache.etag,
      };
    }

    options.hooks = {
      beforeRedirect: [removeAuthorization],
    };

    applyDefaultHeaders(options);

    options = applyHostRules(url, options);
    if (options.enabled === false) {
      logger.debug(`Host is disabled - rejecting request. HostUrl: ${url}`);
      throw new Error(HOST_DISABLED);
    }
    options = applyAuthorization(options);
    options.timeout ??= 60000;

    const memCacheKey =
      options.memCache !== false &&
      (options.method === 'get' || options.method === 'head')
        ? hash(
            `got-${JSON.stringify({
              url,
              headers: options.headers,
              method: options.method,
            })}`,
          )
        : null;

    let resPromise: Promise<HttpResponse<T>> | null = null;

    // Cache GET requests unless memCache=false
    if (memCacheKey) {
      resPromise = memCache.get(memCacheKey);
    }

    // istanbul ignore else: no cache tests
    if (!resPromise) {
      const startTime = Date.now();
      const httpTask: GotTask<T> = () => {
        const queueDuration = Date.now() - startTime;
        return gotTask(url, options, {
          method: options.method,
          url,
          queueDuration,
        });
      };

      const throttle = this.getThrottle(url);
      const throttledTask: GotTask<T> = throttle
        ? () => throttle.add<HttpResponse<T>>(httpTask)
        : httpTask;

      const queue = getQueue(url);
      const queuedTask: GotTask<T> = queue
        ? () => queue.add<HttpResponse<T>>(throttledTask)
        : throttledTask;

      resPromise = queuedTask();

      if (memCacheKey) {
        memCache.set(memCacheKey, resPromise);
      }
    }

    try {
      const res = await resPromise;
      const deepCopyNeeded = !!memCacheKey && res.statusCode !== 304;
      const resCopy = copyResponse(res, deepCopyNeeded);
      resCopy.authorization = !!options?.headers?.authorization;
      return resCopy;
    } catch (err) {
      const { abortOnError, abortIgnoreStatusCodes } = options;
      if (abortOnError && !abortIgnoreStatusCodes?.includes(err.statusCode)) {
        throw new ExternalHostError(err);
      }
      throw err;
    }
  }

  get(
    url: string,
    options: HttpOptions & HttpRequestOptions<string> = {},
  ): Promise<HttpResponse> {
    return this.request<string>(url, options);
  }

  head(url: string, options: HttpOptions = {}): Promise<HttpResponse> {
    return this.request<string>(url, { ...options, method: 'head' });
  }

  getBuffer(
    url: string,
    options: HttpOptions = {},
  ): Promise<HttpResponse<Buffer>> {
    return this.request<Buffer>(url, {
      ...options,
      responseType: 'buffer',
    });
  }

  private async requestJson<ResT = unknown>(
    method: InternalHttpOptions['method'],
    {
      url,
      httpOptions: requestOptions,
      schema,
    }: JsonArgs<Opts & HttpRequestOptions<ResT>, ResT>,
  ): Promise<HttpResponse<ResT>> {
    const { body, ...httpOptions } = { ...requestOptions };
    const opts: InternalHttpOptions = {
      ...httpOptions,
      method,
      responseType: 'json',
    };
    // signal that we expect a json response
    opts.headers = {
      accept: 'application/json',
      ...opts.headers,
    };
    if (body) {
      opts.json = body;
    }
    const res = await this.request<ResT>(url, opts);

    const etagCacheHit =
      httpOptions.etagCache && res.statusCode === 304
        ? clone(httpOptions.etagCache.data)
        : null;

    if (!schema) {
      if (etagCacheHit) {
        res.body = etagCacheHit;
      }
      return res;
    }

    if (etagCacheHit) {
      res.body = etagCacheHit;
    } else {
      res.body = await schema.parseAsync(res.body);
    }
    return res;
  }

  private resolveArgs<ResT = unknown>(
    arg1: string,
    arg2: Opts | ZodType<ResT> | undefined,
    arg3: ZodType<ResT> | undefined,
  ): JsonArgs<Opts, ResT> {
    const res: JsonArgs<Opts, ResT> = { url: arg1 };

    if (arg2 instanceof ZodType) {
      res.schema = arg2;
    } else if (arg2) {
      res.httpOptions = arg2;
    }

    if (arg3) {
      res.schema = arg3;
    }

    return res;
  }

  async getPlain(url: string, options?: Opts): Promise<HttpResponse> {
    const opt = options ?? {};
    return await this.get(url, {
      headers: {
        Accept: 'text/plain',
      },
      ...opt,
    });
  }

  getJson<ResT>(
    url: string,
    options?: Opts & HttpRequestOptions<ResT>,
  ): Promise<HttpResponse<ResT>>;
  getJson<ResT, Schema extends ZodType<ResT> = ZodType<ResT>>(
    url: string,
    schema: Schema,
  ): Promise<HttpResponse<Infer<Schema>>>;
  getJson<ResT, Schema extends ZodType<ResT> = ZodType<ResT>>(
    url: string,
    options: Opts & HttpRequestOptions<Infer<Schema>>,
    schema: Schema,
  ): Promise<HttpResponse<Infer<Schema>>>;
  getJson<ResT = unknown, Schema extends ZodType<ResT> = ZodType<ResT>>(
    arg1: string,
    arg2?: (Opts & HttpRequestOptions<ResT>) | Schema,
    arg3?: Schema,
  ): Promise<HttpResponse<ResT>> {
    const args = this.resolveArgs<ResT>(arg1, arg2, arg3);
    return this.requestJson<ResT>('get', args);
  }

  getJsonSafe<
    ResT extends NonNullable<unknown>,
    Schema extends ZodType<ResT> = ZodType<ResT>,
  >(url: string, schema: Schema): AsyncResult<Infer<Schema>, SafeJsonError>;
  getJsonSafe<
    ResT extends NonNullable<unknown>,
    Schema extends ZodType<ResT> = ZodType<ResT>,
  >(
    url: string,
    options: Opts & HttpRequestOptions<Infer<Schema>>,
    schema: Schema,
  ): AsyncResult<Infer<Schema>, SafeJsonError>;
  getJsonSafe<
    ResT extends NonNullable<unknown>,
    Schema extends ZodType<ResT> = ZodType<ResT>,
  >(
    arg1: string,
    arg2?: (Opts & HttpRequestOptions<ResT>) | Schema,
    arg3?: Schema,
  ): AsyncResult<ResT, SafeJsonError> {
    const args = this.resolveArgs<ResT>(arg1, arg2, arg3);
    return Result.wrap(this.requestJson<ResT>('get', args)).transform(
      (response) => Result.ok(response.body),
    );
  }

  headJson(url: string, httpOptions?: Opts): Promise<HttpResponse<never>> {
    return this.requestJson<never>('head', { url, httpOptions });
  }

  postJson<T>(url: string, options?: Opts): Promise<HttpResponse<T>>;
  postJson<T, Schema extends ZodType<T> = ZodType<T>>(
    url: string,
    schema: Schema,
  ): Promise<HttpResponse<Infer<Schema>>>;
  postJson<T, Schema extends ZodType<T> = ZodType<T>>(
    url: string,
    options: Opts,
    schema: Schema,
  ): Promise<HttpResponse<Infer<Schema>>>;
  postJson<T = unknown, Schema extends ZodType<T> = ZodType<T>>(
    arg1: string,
    arg2?: Opts | Schema,
    arg3?: Schema,
  ): Promise<HttpResponse<T>> {
    const args = this.resolveArgs(arg1, arg2, arg3);
    return this.requestJson<T>('post', args);
  }

  putJson<T>(url: string, options?: Opts): Promise<HttpResponse<T>>;
  putJson<T, Schema extends ZodType<T> = ZodType<T>>(
    url: string,
    schema: Schema,
  ): Promise<HttpResponse<Infer<Schema>>>;
  putJson<T, Schema extends ZodType<T> = ZodType<T>>(
    url: string,
    options: Opts,
    schema: Schema,
  ): Promise<HttpResponse<Infer<Schema>>>;
  putJson<T = unknown, Schema extends ZodType<T> = ZodType<T>>(
    arg1: string,
    arg2?: Opts | Schema,
    arg3?: ZodType,
  ): Promise<HttpResponse<T>> {
    const args = this.resolveArgs(arg1, arg2, arg3);
    return this.requestJson<T>('put', args);
  }

  patchJson<T>(url: string, options?: Opts): Promise<HttpResponse<T>>;
  patchJson<T, Schema extends ZodType<T> = ZodType<T>>(
    url: string,
    schema: Schema,
  ): Promise<HttpResponse<Infer<Schema>>>;
  patchJson<T, Schema extends ZodType<T> = ZodType<T>>(
    url: string,
    options: Opts,
    schema: Schema,
  ): Promise<HttpResponse<Infer<Schema>>>;
  patchJson<T = unknown, Schema extends ZodType<T> = ZodType<T>>(
    arg1: string,
    arg2?: Opts | Schema,
    arg3?: Schema,
  ): Promise<HttpResponse<T>> {
    const args = this.resolveArgs(arg1, arg2, arg3);
    return this.requestJson<T>('patch', args);
  }

  deleteJson<T>(url: string, options?: Opts): Promise<HttpResponse<T>>;
  deleteJson<T, Schema extends ZodType<T> = ZodType<T>>(
    url: string,
    schema: Schema,
  ): Promise<HttpResponse<Infer<Schema>>>;
  deleteJson<T, Schema extends ZodType<T> = ZodType<T>>(
    url: string,
    options: Opts,
    schema: Schema,
  ): Promise<HttpResponse<Infer<Schema>>>;
  deleteJson<T = unknown, Schema extends ZodType<T> = ZodType<T>>(
    arg1: string,
    arg2?: Opts | Schema,
    arg3?: Schema,
  ): Promise<HttpResponse<T>> {
    const args = this.resolveArgs(arg1, arg2, arg3);
    return this.requestJson<T>('delete', args);
  }

  stream(url: string, options?: HttpOptions): NodeJS.ReadableStream {
    // TODO: fix types (#22198)
    let combinedOptions: any = {
      method: 'get',
      ...this.options,
      hostType: this.hostType,
      ...options,
    };

    let resolvedUrl = url;
    // istanbul ignore else: needs test
    if (options?.baseUrl) {
      resolvedUrl = resolveBaseUrl(options.baseUrl, url);
    }

    applyDefaultHeaders(combinedOptions);
    combinedOptions = applyHostRules(resolvedUrl, combinedOptions);
    if (combinedOptions.enabled === false) {
      throw new Error(HOST_DISABLED);
    }
    combinedOptions = applyAuthorization(combinedOptions);

    return got.stream(resolvedUrl, combinedOptions);
  }
}
