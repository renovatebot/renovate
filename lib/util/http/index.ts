import is from '@sindresorhus/is';
import merge from 'deepmerge';
import type { Options, RetryObject } from 'got';
import got, { RequestError } from 'got';
import type { SetRequired } from 'type-fest';
import type { infer as Infer, ZodError } from 'zod';
import { ZodType } from 'zod';
import { GlobalConfig } from '../../config/global';
import { HOST_DISABLED } from '../../constants/error-messages';
import { pkg } from '../../expose.cjs';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as memCache from '../cache/memory';
import { hash } from '../hash';
import { type AsyncResult, Result } from '../result';
import { type HttpRequestStatsDataPoint, HttpStats } from '../stats';
import { resolveBaseUrl } from '../url';
import { parseSingleYaml } from '../yaml';
import { applyAuthorization, removeAuthorization } from './auth';
import { hooks } from './hooks';
import { applyHostRule, findMatchingRule } from './host-rules';
import { getQueue } from './queue';
import { getRetryAfter, wrapWithRetry } from './retry-after';
import { getThrottle } from './throttle';
import type {
  GotJSONOptions,
  GotOptions,
  GotTask,
  HttpOptions,
  HttpResponse,
  InternalHttpOptions,
} from './types';
// TODO: refactor code to remove this (#9651)
import './legacy';
import { copyResponse } from './util';

export { RequestError as HttpError };

export class EmptyResultError extends Error {}
export type SafeJsonError = RequestError | ZodError | EmptyResultError;

type HttpFnArgs<
  Opts extends HttpOptions,
  ResT = unknown,
  Schema extends ZodType<ResT> = ZodType<ResT>,
> = {
  url: string;
  httpOptions?: Opts;
  schema?: Schema;
};

function applyDefaultHeaders(options: Options): void {
  const renovateVersion = pkg.version;
  options.headers = {
    ...options.headers,
    'user-agent':
      GlobalConfig.get('userAgent') ??
      `RenovateBot/${renovateVersion} (https://github.com/renovatebot/renovate)`,
  };
}

type QueueStatsData = Pick<HttpRequestStatsDataPoint, 'queueMs'>;

// Note on types:
// options.requestType can be either 'json' or 'buffer', but `T` should be
// `Buffer` in the latter case.
// We don't declare overload signatures because it's immediately wrapped by
// `request`.
async function gotTask<T>(
  url: string,
  options: SetRequired<GotOptions, 'method'>,
  queueStats: QueueStatsData,
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
    HttpStats.write({
      method: options.method,
      url,
      reqMs: duration,
      queueMs: queueStats.queueMs,
      status: statusCode,
    });
  }
}

export class Http<Opts extends HttpOptions = HttpOptions> {
  private options?: GotOptions;

  constructor(
    protected hostType: string,
    options: HttpOptions = {},
  ) {
    const retryLimit = process.env.NODE_ENV === 'test' ? 0 : 2;
    this.options = merge<GotOptions>(
      options,
      {
        context: { hostType },
        retry: {
          calculateDelay: (retryObject) =>
            this.calculateRetryDelay(retryObject),
          limit: retryLimit,
          maxRetryAfter: 0, // Don't rely on `got` retry-after handling, just let it fail and then we'll handle it
        },
      },
      { isMergeableObject: is.plainObject },
    );
  }

  protected async request<T>(
    requestUrl: string | URL,
    httpOptions: InternalHttpOptions,
  ): Promise<HttpResponse<T>> {
    let url = requestUrl.toString();
    if (httpOptions?.baseUrl) {
      url = resolveBaseUrl(httpOptions.baseUrl, url);
    }

    let options = merge<SetRequired<GotOptions, 'method'>, InternalHttpOptions>(
      {
        method: 'get',
        ...this.options,
        hostType: this.hostType,
      },
      httpOptions,
      { isMergeableObject: is.plainObject },
    );

    logger.trace(`HTTP request: ${options.method.toUpperCase()} ${url}`);

    options.hooks = {
      beforeRedirect: [removeAuthorization],
    };

    applyDefaultHeaders(options);

    if (
      is.undefined(options.readOnly) &&
      ['head', 'get'].includes(options.method)
    ) {
      options.readOnly = true;
    }

    const hostRule = findMatchingRule(url, options);
    options = applyHostRule(url, options, hostRule);
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
      if (options.cacheProvider) {
        await options.cacheProvider.setCacheHeaders(url, options);
      }

      const startTime = Date.now();
      const httpTask: GotTask<T> = () => {
        const queueMs = Date.now() - startTime;
        return gotTask(url, options, { queueMs });
      };

      const throttle = getThrottle(url);
      const throttledTask: GotTask<T> = throttle
        ? () => throttle.add<HttpResponse<T>>(httpTask)
        : httpTask;

      const queue = getQueue(url);
      const queuedTask: GotTask<T> = queue
        ? () => queue.add<HttpResponse<T>>(throttledTask)
        : throttledTask;

      const { maxRetryAfter = 60 } = hostRule;
      resPromise = wrapWithRetry(queuedTask, url, getRetryAfter, maxRetryAfter);

      if (memCacheKey) {
        memCache.set(memCacheKey, resPromise);
      }
    }

    try {
      const res = await resPromise;
      const deepCopyNeeded = !!memCacheKey && res.statusCode !== 304;
      const resCopy = copyResponse(res, deepCopyNeeded);
      resCopy.authorization = !!options?.headers?.authorization;

      if (options.cacheProvider) {
        return await options.cacheProvider.wrapResponse(url, resCopy);
      }

      return resCopy;
    } catch (err) {
      const { abortOnError, abortIgnoreStatusCodes } = options;
      if (abortOnError && !abortIgnoreStatusCodes?.includes(err.statusCode)) {
        throw new ExternalHostError(err);
      }
      throw err;
    }
  }

  protected calculateRetryDelay({ computedValue }: RetryObject): number {
    return computedValue;
  }

  get(url: string, options: HttpOptions = {}): Promise<HttpResponse> {
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
    { url, httpOptions: requestOptions, schema }: HttpFnArgs<Opts, ResT>,
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

    if (!schema) {
      return res;
    }

    res.body = await schema.parseAsync(res.body);
    return res;
  }

  private resolveArgs<ResT = unknown>(
    arg1: string,
    arg2: Opts | ZodType<ResT> | undefined,
    arg3: ZodType<ResT> | undefined,
  ): HttpFnArgs<Opts, ResT> {
    const res: HttpFnArgs<Opts, ResT> = { url: arg1 };

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

  /**
   * @deprecated use `getYaml` instead
   */
  async getYamlUnchecked<ResT>(
    url: string,
    options?: Opts,
  ): Promise<HttpResponse<ResT>> {
    const res = await this.get(url, options);
    const body = parseSingleYaml<ResT>(res.body);
    return { ...res, body };
  }

  async getYaml<Schema extends ZodType<any, any, any>>(
    url: string,
    schema: Schema,
  ): Promise<HttpResponse<Infer<Schema>>>;
  async getYaml<Schema extends ZodType<any, any, any>>(
    url: string,
    options: Opts,
    schema: Schema,
  ): Promise<HttpResponse<Infer<Schema>>>;
  async getYaml<Schema extends ZodType<any, any, any>>(
    arg1: string,
    arg2?: Opts | Schema,
    arg3?: Schema,
  ): Promise<HttpResponse<Infer<Schema>>> {
    const url = arg1;
    let schema: Schema;
    let httpOptions: Opts | undefined;
    if (arg3) {
      schema = arg3;
      httpOptions = arg2 as Opts;
    } else {
      schema = arg2 as Schema;
    }

    const opts: InternalHttpOptions = {
      ...httpOptions,
      method: 'get',
    };

    const res = await this.get(url, opts);
    const body = await schema.parseAsync(parseSingleYaml(res.body));
    return { ...res, body };
  }

  getYamlSafe<
    ResT extends NonNullable<unknown>,
    Schema extends ZodType<ResT> = ZodType<ResT>,
  >(url: string, schema: Schema): AsyncResult<Infer<Schema>, SafeJsonError>;
  getYamlSafe<
    ResT extends NonNullable<unknown>,
    Schema extends ZodType<ResT> = ZodType<ResT>,
  >(
    url: string,
    options: Opts,
    schema: Schema,
  ): AsyncResult<Infer<Schema>, SafeJsonError>;
  getYamlSafe<
    ResT extends NonNullable<unknown>,
    Schema extends ZodType<ResT> = ZodType<ResT>,
  >(
    arg1: string,
    arg2: Opts | Schema,
    arg3?: Schema,
  ): AsyncResult<ResT, SafeJsonError> {
    const url = arg1;
    let schema: Schema;
    let httpOptions: Opts | undefined;
    if (arg3) {
      schema = arg3;
      httpOptions = arg2 as Opts;
    } else {
      schema = arg2 as Schema;
    }

    let res: AsyncResult<HttpResponse<ResT>, SafeJsonError>;
    if (httpOptions) {
      res = Result.wrap(this.getYaml(url, httpOptions, schema));
    } else {
      res = Result.wrap(this.getYaml(url, schema));
    }

    return res.transform((response) => Result.ok(response.body));
  }

  /**
   * Request JSON and return the response without any validation.
   *
   * The usage of this method is discouraged, please use `getJson` instead.
   *
   * If you're new to Zod schema validation library:
   * - consult the [documentation of Zod library](https://github.com/colinhacks/zod?tab=readme-ov-file#basic-usage)
   * - search the Renovate codebase for 'zod' module usage
   * - take a look at the `schema-utils.ts` file for Renovate-specific schemas and utilities
   */
  getJsonUnchecked<ResT = unknown>(
    url: string,
    options?: Opts,
  ): Promise<HttpResponse<ResT>> {
    return this.requestJson<ResT>('get', { url, httpOptions: options });
  }

  /**
   * Request JSON with a Zod schema for the response,
   * throwing an error if the response is not valid.
   *
   * @param url
   * @param schema Zod schema for the response
   */
  getJson<Schema extends ZodType<any, any, any>>(
    url: string,
    schema: Schema,
  ): Promise<HttpResponse<Infer<Schema>>>;
  getJson<Schema extends ZodType<any, any, any>>(
    url: string,
    options: Opts,
    schema: Schema,
  ): Promise<HttpResponse<Infer<Schema>>>;
  getJson<Schema extends ZodType<any, any, any>>(
    arg1: string,
    arg2?: Opts | Schema,
    arg3?: Schema,
  ): Promise<HttpResponse<Infer<Schema>>> {
    const args = this.resolveArgs<Infer<Schema>>(arg1, arg2, arg3);
    return this.requestJson<Infer<Schema>>('get', args);
  }

  /**
   * Request JSON with a Zod schema for the response,
   * wrapping response data in a `Result` class.
   *
   * @param url
   * @param schema Zod schema for the response
   */
  getJsonSafe<ResT extends NonNullable<unknown>, Schema extends ZodType<ResT>>(
    url: string,
    schema: Schema,
  ): AsyncResult<Infer<Schema>, SafeJsonError>;
  getJsonSafe<ResT extends NonNullable<unknown>, Schema extends ZodType<ResT>>(
    url: string,
    options: Opts,
    schema: Schema,
  ): AsyncResult<Infer<Schema>, SafeJsonError>;
  getJsonSafe<ResT extends NonNullable<unknown>, Schema extends ZodType<ResT>>(
    arg1: string,
    arg2?: Opts | Schema,
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

    if (
      is.undefined(combinedOptions.readOnly) &&
      ['head', 'get'].includes(combinedOptions.method)
    ) {
      combinedOptions.readOnly = true;
    }

    const hostRule = findMatchingRule(url, combinedOptions);
    combinedOptions = applyHostRule(resolvedUrl, combinedOptions, hostRule);
    if (combinedOptions.enabled === false) {
      throw new Error(HOST_DISABLED);
    }
    combinedOptions = applyAuthorization(combinedOptions);

    return got.stream(resolvedUrl, combinedOptions);
  }
}
