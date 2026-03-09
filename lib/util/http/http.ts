import { isPlainObject, isUndefined } from '@sindresorhus/is';
import merge from 'deepmerge';
import type { Options, OptionsInit, RetryObject } from 'got';
import type { Merge, SetRequired } from 'type-fest';
import type { z } from 'zod/v3';
import { ZodType } from 'zod/v3';
import { GlobalConfig } from '../../config/global.ts';
import { HOST_DISABLED } from '../../constants/error-messages.ts';
import { pkg } from '../../expose.ts';
import { logger } from '../../logger/index.ts';
import { ExternalHostError } from '../../types/errors/external-host-error.ts';
import * as memCache from '../cache/memory/index.ts';
import { getEnv } from '../env.ts';
import { hash } from '../hash.ts';
import { acquireLock } from '../mutex.ts';
import { type AsyncResult, Result } from '../result.ts';
import { Toml } from '../schema-utils/index.ts';
import { ObsoleteCacheHitLogger } from '../stats.ts';
import { isHttpUrl, parseUrl, resolveBaseUrl } from '../url.ts';
import { parseSingleYaml } from '../yaml.ts';
import { applyAuthorization } from './auth.ts';
import type { HttpCacheProvider } from './cache/types.ts';
import { fetch, normalize, stream } from './got.ts';
import { applyHostRule, findMatchingRule } from './host-rules.ts';

import { getQueue } from './queue.ts';
import { getRetryAfter, wrapWithRetry } from './retry-after.ts';
import { getThrottle } from './throttle.ts';
import type {
  GotOptions,
  GotStreamOptions,
  GotTask,
  HttpMethod,
  HttpOptions,
  HttpResponse,
  SafeJsonError,
} from './types.ts';
import { copyResponse } from './util.ts';

export interface InternalJsonUnsafeOptions<
  Opts extends HttpOptions = HttpOptions,
> {
  url: string | URL;
  httpOptions?: Opts;
}

export interface InternalJsonOptions<
  Opts extends HttpOptions,
  ResT = unknown,
  Schema extends ZodType<ResT> = ZodType<ResT>,
> extends InternalJsonUnsafeOptions<Opts> {
  schema?: Schema;
}

export type InternalGotOptions = SetRequired<GotOptions, 'method' | 'context'>;

export interface InternalHttpOptions extends HttpOptions {
  json?: HttpOptions['body'];

  method?: HttpMethod;

  parseJson?: Options['parseJson'];
}

export function applyDefaultHeaders(options: OptionsInit): void {
  const renovateVersion = pkg.version;
  options.headers = {
    ...options.headers,
    'user-agent':
      GlobalConfig.get('userAgent') ??
      `Renovate/${renovateVersion} (https://github.com/renovatebot/renovate)`,
  };
}

export abstract class HttpBase<
  JSONOpts extends HttpOptions = HttpOptions,
  Opts extends HttpOptions = HttpOptions,
> {
  private readonly options: InternalGotOptions;

  protected get baseUrl(): string | undefined {
    return undefined;
  }

  protected hostType: string;

  constructor(hostType: string, options: HttpOptions = {}) {
    this.hostType = hostType;
    const retryLimit = getEnv().NODE_ENV === 'test' ? 0 : 2;
    this.options = merge<InternalGotOptions>(
      options,
      {
        method: 'get',
        context: { hostType },
        retry: {
          calculateDelay: (retryObject) =>
            this.calculateRetryDelay(retryObject),
          limit: retryLimit,
          maxRetryAfter: 0, // Don't rely on `got` retry-after handling, just let it fail and then we'll handle it
        },
      },
      { isMergeableObject: isPlainObject },
    );
  }

  private async request(
    requestUrl: string | URL,
    httpOptions: InternalHttpOptions,
  ): Promise<HttpResponse<string>>;
  private async request(
    requestUrl: string | URL,
    httpOptions: InternalHttpOptions & { responseType: 'text' },
  ): Promise<HttpResponse<string>>;
  private async request(
    requestUrl: string | URL,
    httpOptions: InternalHttpOptions & { responseType: 'buffer' },
  ): Promise<HttpResponse<Buffer>>;
  private async request<T = unknown>(
    requestUrl: string | URL,
    httpOptions: InternalHttpOptions & { responseType: 'json' },
  ): Promise<HttpResponse<T>>;

  private async request(
    requestUrl: string | URL,
    httpOptions: InternalHttpOptions,
  ): Promise<HttpResponse<unknown>> {
    const resolvedUrl = this.resolveUrl(requestUrl, httpOptions);
    const url = resolvedUrl.toString();

    this.processOptions(resolvedUrl, httpOptions);

    let options = merge<InternalGotOptions, InternalHttpOptions>(
      {
        ...this.options,
        hostType: this.hostType,
      },
      httpOptions,
      { isMergeableObject: isPlainObject },
    );

    const method = options.method.toLowerCase();
    const isReadMethod = ['head', 'get'].includes(method);

    logger.trace(`HTTP request: ${method.toUpperCase()} ${url}`);

    applyDefaultHeaders(options);

    if (isUndefined(options.readOnly) && isReadMethod) {
      options.readOnly = true;
    }

    const hostRule = findMatchingRule(url, options);
    options = applyHostRule(url, options, hostRule);
    if (options.enabled === false) {
      logger.debug(`Host is disabled - rejecting request. HostUrl: ${url}`);
      throw new Error(HOST_DISABLED);
    }
    options = applyAuthorization(options);
    const timeout = options.timeout ?? 60000;
    options.timeout = timeout;

    let cacheProvider: HttpCacheProvider | undefined;
    if (isReadMethod && options.cacheProvider) {
      cacheProvider = options.cacheProvider;
    }

    const memCacheKey =
      !process.env.RENOVATE_X_DISABLE_HTTP_MEMCACHE &&
      !cacheProvider &&
      options.memCache !== false &&
      isReadMethod
        ? hash(
            `got-${JSON.stringify({
              url,
              headers: options.headers,
              method,
            })}`,
          )
        : null;

    let resPromise: Promise<HttpResponse<unknown>> | null = null;

    // Cache GET requests unless memCache=false
    if (memCacheKey) {
      resPromise = memCache.get(memCacheKey);

      /* v8 ignore next: temporary code */
      if (resPromise && !cacheProvider) {
        ObsoleteCacheHitLogger.write(url);
      }
    }

    // v8 ignore else -- TODO: add test #40625
    if (!resPromise) {
      if (cacheProvider) {
        await cacheProvider.setCacheHeaders(method, url, options);
      }

      const startTime = Date.now();
      const httpTask: GotTask = async () => {
        let releaseLock: undefined | (() => void);
        if (isReadMethod) {
          releaseLock = await acquireLock(
            `${options.method} ${url}`,
            'http-mutex',
            timeout * 2,
          );
        }
        try {
          const cachedResponse = await cacheProvider?.bypassServer<unknown>(
            options.method,
            url,
          );
          if (cachedResponse) {
            return cachedResponse;
          }

          const queueMs = Date.now() - startTime;
          return fetch(url, this._normalizeOptions(options), {
            queueMs,
          });
        } finally {
          releaseLock?.();
        }
      };

      const throttle = getThrottle(url);
      const throttledTask = throttle ? () => throttle.add(httpTask) : httpTask;

      const queue = getQueue(url);
      const queuedTask = queue ? () => queue.add(throttledTask) : throttledTask;

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

      if (cacheProvider) {
        return await cacheProvider.wrapServerResponse(method, url, resCopy);
      }

      return resCopy;
    } catch (err) {
      const { abortOnError, abortIgnoreStatusCodes } = options;
      if (abortOnError && !abortIgnoreStatusCodes?.includes(err.statusCode)) {
        throw new ExternalHostError(err);
      }

      const staleResponse = await cacheProvider?.bypassServer<string | Buffer>(
        method,
        url,
        true,
      );
      if (staleResponse) {
        logger.debug(
          { err },
          `Request error: returning stale cache instead for ${url}`,
        );
        return staleResponse;
      }

      this.handleError(requestUrl, httpOptions, err);
    }
  }

  private _normalizeOptions<T extends OptionsInit>(options: T): T {
    return normalize(options, this.extraOptions());
  }

  /**
   * Returns Renovate extra options which needs to be removed before passing to got.
   * @returns extra Renovate options.
   */
  protected extraOptions(): readonly string[] {
    return ['baseUrl', 'cacheProvider', 'readOnly'] as (keyof HttpOptions)[];
  }

  protected processOptions(_url: URL, _options: InternalHttpOptions): void {
    // noop
  }

  protected handleError(
    _url: string | URL,
    _httpOptions: HttpOptions,
    err: Error,
  ): never {
    throw err;
  }

  resolveUrl(
    requestUrl: string | URL,
    options: HttpOptions | undefined = undefined,
  ): URL {
    let url = requestUrl;

    if (url instanceof URL) {
      // already a aboslute URL
      return url;
    }

    const baseUrl = options?.baseUrl ?? this.baseUrl;
    if (baseUrl) {
      url = resolveBaseUrl(baseUrl, url);
    }

    const parsedUrl = parseUrl(url);
    if (!parsedUrl || !isHttpUrl(parsedUrl)) {
      logger.error(
        { url: requestUrl, baseUrl, resolvedUrl: url },
        'Request Error: cannot parse url',
      );
      throw new Error('Invalid URL');
    }
    return parsedUrl;
  }

  protected calculateRetryDelay({ computedValue }: RetryObject): number {
    return computedValue;
  }

  get(
    url: string,
    options: HttpOptions = {},
  ): Promise<HttpResponse<string | Buffer>> {
    return this.request(url, options);
  }

  head(url: string, options: HttpOptions = {}): Promise<HttpResponse<never>> {
    // to complex to validate
    return this.request(url, {
      ...options,
      responseType: 'text',
      method: 'head',
    }) as Promise<HttpResponse<never>>;
  }

  getText(
    url: string | URL,
    options: HttpOptions = {},
  ): Promise<HttpResponse<string>> {
    return this.request(url, { ...options, responseType: 'text' });
  }

  getBuffer(
    url: string | URL,
    options: HttpOptions = {},
  ): Promise<HttpResponse<Buffer>> {
    return this.request(url, { ...options, responseType: 'buffer' });
  }

  protected requestJsonUnsafe<ResT>(
    method: HttpMethod,
    { url, httpOptions: requestOptions }: InternalJsonUnsafeOptions<JSONOpts>,
  ): Promise<HttpResponse<ResT>> {
    const { body: json, ...httpOptions } = { ...requestOptions };
    const opts: InternalHttpOptions = {
      ...httpOptions,
      method,
    };
    // signal that we expect a json response
    opts.headers = {
      accept: 'application/json',
      ...opts.headers,
    };
    if (json) {
      opts.json = json;
    }
    return this.request<ResT>(url, { ...opts, responseType: 'json' });
  }

  private async requestJson<ResT, Schema extends ZodType<ResT> = ZodType<ResT>>(
    method: HttpMethod,
    options: InternalJsonOptions<JSONOpts, ResT, Schema>,
  ): Promise<HttpResponse<ResT>> {
    const res = await this.requestJsonUnsafe<ResT>(method, options);

    if (options.schema) {
      res.body = await options.schema.parseAsync(res.body);
    }

    return res;
  }

  private resolveArgs<ResT = unknown>(
    arg1: string,
    arg2: JSONOpts | ZodType<ResT> | undefined,
    arg3: ZodType<ResT> | undefined,
  ): InternalJsonOptions<JSONOpts, ResT> {
    const res: InternalJsonOptions<JSONOpts, ResT> = { url: arg1 };

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
    return await this.getText(url, {
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
    const res = await this.getText(url, options);
    const body = parseSingleYaml<ResT>(res.body);
    return { ...res, body };
  }

  async getYaml<Schema extends ZodType<any, any, any>>(
    url: string,
    schema: Schema,
  ): Promise<HttpResponse<z.infer<Schema>>>;
  async getYaml<Schema extends ZodType<any, any, any>>(
    url: string,
    options: Opts,
    schema: Schema,
  ): Promise<HttpResponse<z.infer<Schema>>>;
  async getYaml<Schema extends ZodType<any, any, any>>(
    arg1: string,
    arg2?: Opts | Schema,
    arg3?: Schema,
  ): Promise<HttpResponse<z.infer<Schema>>> {
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

    const res = await this.getText(url, opts);
    const body = await schema.parseAsync(parseSingleYaml(res.body));
    return { ...res, body };
  }

  getYamlSafe<
    ResT extends NonNullable<unknown>,
    Schema extends ZodType<ResT> = ZodType<ResT>,
  >(url: string, schema: Schema): AsyncResult<z.infer<Schema>, SafeJsonError>;
  getYamlSafe<
    ResT extends NonNullable<unknown>,
    Schema extends ZodType<ResT> = ZodType<ResT>,
  >(
    url: string,
    options: Opts,
    schema: Schema,
  ): AsyncResult<z.infer<Schema>, SafeJsonError>;
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
    options?: JSONOpts,
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
  ): Promise<HttpResponse<z.infer<Schema>>>;
  getJson<Schema extends ZodType<any, any, any>>(
    url: string,
    options: JSONOpts,
    schema: Schema,
  ): Promise<HttpResponse<z.infer<Schema>>>;
  getJson<Schema extends ZodType<any, any, any>>(
    arg1: string,
    arg2?: JSONOpts | Schema,
    arg3?: Schema,
  ): Promise<HttpResponse<z.infer<Schema>>> {
    const args = this.resolveArgs<z.infer<Schema>>(arg1, arg2, arg3);
    return this.requestJson<z.infer<Schema>>('get', args);
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
  ): AsyncResult<z.infer<Schema>, SafeJsonError>;
  getJsonSafe<ResT extends NonNullable<unknown>, Schema extends ZodType<ResT>>(
    url: string,
    options: JSONOpts,
    schema: Schema,
  ): AsyncResult<z.infer<Schema>, SafeJsonError>;
  getJsonSafe<ResT extends NonNullable<unknown>, Schema extends ZodType<ResT>>(
    arg1: string,
    arg2?: JSONOpts | Schema,
    arg3?: Schema,
  ): AsyncResult<ResT, SafeJsonError> {
    const args = this.resolveArgs<ResT>(arg1, arg2, arg3);
    return Result.wrap(this.requestJson<ResT>('get', args)).transform(
      (response) => Result.ok(response.body),
    );
  }

  /**
   * @deprecated use `head` instead
   */
  headJson(url: string, httpOptions?: JSONOpts): Promise<HttpResponse<never>> {
    return this.requestJson<never>('head', { url, httpOptions });
  }

  postJson<T>(url: string, options?: JSONOpts): Promise<HttpResponse<T>>;
  postJson<T, Schema extends ZodType<T> = ZodType<T>>(
    url: string,
    schema: Schema,
  ): Promise<HttpResponse<z.infer<Schema>>>;
  postJson<T, Schema extends ZodType<T> = ZodType<T>>(
    url: string,
    options: JSONOpts,
    schema: Schema,
  ): Promise<HttpResponse<z.infer<Schema>>>;
  postJson<T = unknown, Schema extends ZodType<T> = ZodType<T>>(
    arg1: string,
    arg2?: JSONOpts | Schema,
    arg3?: Schema,
  ): Promise<HttpResponse<T>> {
    const args = this.resolveArgs(arg1, arg2, arg3);
    return this.requestJson<T>('post', args);
  }

  putJson<T>(url: string, options?: JSONOpts): Promise<HttpResponse<T>>;
  putJson<T, Schema extends ZodType<T> = ZodType<T>>(
    url: string,
    schema: Schema,
  ): Promise<HttpResponse<z.infer<Schema>>>;
  putJson<T, Schema extends ZodType<T> = ZodType<T>>(
    url: string,
    options: JSONOpts,
    schema: Schema,
  ): Promise<HttpResponse<z.infer<Schema>>>;
  putJson<T = unknown, Schema extends ZodType<T> = ZodType<T>>(
    arg1: string,
    arg2?: JSONOpts | Schema,
    arg3?: ZodType,
  ): Promise<HttpResponse<T>> {
    const args = this.resolveArgs(arg1, arg2, arg3);
    return this.requestJson<T>('put', args);
  }

  patchJson<T>(url: string, options?: JSONOpts): Promise<HttpResponse<T>>;
  patchJson<T, Schema extends ZodType<T> = ZodType<T>>(
    url: string,
    schema: Schema,
  ): Promise<HttpResponse<z.infer<Schema>>>;
  patchJson<T, Schema extends ZodType<T> = ZodType<T>>(
    url: string,
    options: JSONOpts,
    schema: Schema,
  ): Promise<HttpResponse<z.infer<Schema>>>;
  patchJson<T = unknown, Schema extends ZodType<T> = ZodType<T>>(
    arg1: string,
    arg2?: JSONOpts | Schema,
    arg3?: Schema,
  ): Promise<HttpResponse<T>> {
    const args = this.resolveArgs(arg1, arg2, arg3);
    return this.requestJson<T>('patch', args);
  }

  deleteJson<T>(url: string, options?: JSONOpts): Promise<HttpResponse<T>>;
  deleteJson<T, Schema extends ZodType<T> = ZodType<T>>(
    url: string,
    schema: Schema,
  ): Promise<HttpResponse<z.infer<Schema>>>;
  deleteJson<T, Schema extends ZodType<T> = ZodType<T>>(
    url: string,
    options: JSONOpts,
    schema: Schema,
  ): Promise<HttpResponse<z.infer<Schema>>>;
  deleteJson<T = unknown, Schema extends ZodType<T> = ZodType<T>>(
    arg1: string,
    arg2?: JSONOpts | Schema,
    arg3?: Schema,
  ): Promise<HttpResponse<T>> {
    const args = this.resolveArgs(arg1, arg2, arg3);
    return this.requestJson<T>('delete', args);
  }

  stream(url: string, options?: HttpOptions): NodeJS.ReadableStream {
    let combinedOptions: Merge<
      GotStreamOptions,
      SetRequired<InternalHttpOptions, 'method'>
    > = {
      ...this.options,
      hostType: this.hostType,
      ...options,
      method: 'get',
    };

    const resolvedUrl = this.resolveUrl(url, options).toString();

    applyDefaultHeaders(combinedOptions);

    // v8 ignore else -- TODO: add test #40625
    if (
      isUndefined(combinedOptions.readOnly) &&
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

    return stream(resolvedUrl, this._normalizeOptions(combinedOptions));
  }

  async getToml<Schema extends ZodType<any, any, any>>(
    url: string,
    schema?: Schema,
  ): Promise<HttpResponse<z.infer<Schema>>>;
  async getToml<Schema extends ZodType<any, any, any>>(
    url: string,
    options: JSONOpts,
    schema: Schema,
  ): Promise<HttpResponse<z.infer<Schema>>>;
  async getToml<Schema extends ZodType<any, any, any>>(
    arg1: string,
    arg2?: JSONOpts | Schema,
    arg3?: Schema,
  ): Promise<HttpResponse<z.infer<Schema>>> {
    const { url, schema, httpOptions } = this.resolveArgs<z.infer<Schema>>(
      arg1,
      arg2,
      arg3,
    );

    const opts: InternalHttpOptions = {
      ...httpOptions,
      method: 'get',
      headers: {
        'Content-Type': 'application/toml',
        ...httpOptions?.headers,
      },
    };

    const res = await this.getText(url, opts);
    if (schema) {
      res.body = await Toml.pipe(schema).parseAsync(res.body);
    } else {
      res.body = (await Toml.parseAsync(res.body)) as z.infer<Schema>;
    }

    return res;
  }
}
