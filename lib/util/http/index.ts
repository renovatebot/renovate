import merge from 'deepmerge';
import got, { Options, RequestError } from 'got';
import hasha from 'hasha';
import { infer as Infer, ZodType } from 'zod';
import { HOST_DISABLED } from '../../constants/error-messages';
import { pkg } from '../../expose.cjs';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as memCache from '../cache/memory';
import { clone } from '../clone';
import { resolveBaseUrl } from '../url';
import { applyAuthorization, removeAuthorization } from './auth';
import { hooks } from './hooks';
import { applyHostRules } from './host-rules';
import { getQueue } from './queue';
import { getThrottle } from './throttle';
import type {
  GotJSONOptions,
  GotOptions,
  HttpOptions,
  HttpResponse,
  InternalHttpOptions,
  RequestStats,
} from './types';
// TODO: refactor code to remove this (#9651)
import './legacy';

export { RequestError as HttpError };

type JsonArgs<
  Opts extends HttpOptions,
  ResT = unknown,
  Schema extends ZodType<ResT> = ZodType<ResT>
> = {
  url: string;
  httpOptions?: Opts;
  schema?: Schema;
};

type Task<T> = () => Promise<HttpResponse<T>>;

function cloneResponse<T extends Buffer | string | any>(
  response: HttpResponse<T>
): HttpResponse<T> {
  const { body, statusCode, headers } = response;
  // clone body and headers so that the cached result doesn't get accidentally mutated
  // Don't use json clone for buffers
  return {
    statusCode,
    body: body instanceof Buffer ? (body.slice() as T) : clone<T>(body),
    headers: clone(headers),
    authorization: !!response.authorization,
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
  options: GotOptions,
  requestStats: Omit<RequestStats, 'duration' | 'statusCode'>
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
      const method = options.method?.toUpperCase() ?? 'GET';
      const code = error.code ?? 'UNKNOWN';
      const retryCount = error.request?.retryCount ?? -1;
      logger.debug(
        `${method} ${url} = (code=${code}, statusCode=${statusCode} retryCount=${retryCount}, duration=${duration})`
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

  constructor(protected hostType: string, options: HttpOptions = {}) {
    this.options = merge<GotOptions>(options, { context: { hostType } });
  }

  protected async request<T>(
    requestUrl: string | URL,
    httpOptions: InternalHttpOptions = {}
  ): Promise<HttpResponse<T>> {
    let url = requestUrl.toString();
    if (httpOptions?.baseUrl) {
      url = resolveBaseUrl(httpOptions.baseUrl, url);
    }

    let options: GotOptions = merge<GotOptions>(
      {
        method: 'get',
        ...this.options,
        hostType: this.hostType,
      },
      httpOptions
    );

    if (process.env.NODE_ENV === 'test') {
      options.retry = 0;
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

    // use sha512: https://www.npmjs.com/package/hasha#algorithm
    const cacheKey = hasha([
      'got-',
      JSON.stringify({
        url,
        headers: options.headers,
        method: options.method,
      }),
    ]);
    let resPromise: Promise<HttpResponse<T>> | null = null;

    // Cache GET requests unless useCache=false
    if (
      (options.method === 'get' || options.method === 'head') &&
      options.useCache !== false
    ) {
      resPromise = memCache.get(cacheKey);
    }

    // istanbul ignore else: no cache tests
    if (!resPromise) {
      const startTime = Date.now();
      const httpTask: Task<T> = () => {
        const queueDuration = Date.now() - startTime;
        return gotTask(url, options, {
          method: options.method ?? 'get',
          url,
          queueDuration,
        });
      };

      const throttle = getThrottle(url);
      const throttledTask: Task<T> = throttle
        ? () => throttle.add<HttpResponse<T>>(httpTask)
        : httpTask;

      const queue = getQueue(url);
      const queuedTask: Task<T> = queue
        ? () => queue.add<HttpResponse<T>>(throttledTask)
        : throttledTask;

      resPromise = queuedTask();

      if (options.method === 'get' || options.method === 'head') {
        memCache.set(cacheKey, resPromise); // always set if it's a get or a head
      }
    }

    try {
      const res = await resPromise;
      res.authorization = !!options?.headers?.authorization;
      return cloneResponse(res);
    } catch (err) {
      const { abortOnError, abortIgnoreStatusCodes } = options;
      if (abortOnError && !abortIgnoreStatusCodes?.includes(err.statusCode)) {
        throw new ExternalHostError(err);
      }
      throw err;
    }
  }

  get(url: string, options: HttpOptions = {}): Promise<HttpResponse> {
    return this.request<string>(url, options);
  }

  head(url: string, options: HttpOptions = {}): Promise<HttpResponse> {
    return this.request<string>(url, { ...options, method: 'head' });
  }

  protected requestBuffer(
    url: string | URL,
    httpOptions?: InternalHttpOptions
  ): Promise<HttpResponse<Buffer> | null> {
    return this.request<Buffer>(url, {
      ...httpOptions,
      responseType: 'buffer',
    });
  }

  getBuffer(
    url: string,
    options: HttpOptions = {}
  ): Promise<HttpResponse<Buffer> | null> {
    return this.requestBuffer(url, options);
  }

  private async requestJson<ResT = unknown>(
    method: InternalHttpOptions['method'],
    { url, httpOptions: requestOptions, schema }: JsonArgs<Opts, ResT>
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
    arg3: ZodType<ResT> | undefined
  ): JsonArgs<Opts, ResT> {
    const res: JsonArgs<Opts, ResT> = { url: arg1 };

    if (arg2 instanceof ZodType<ResT>) {
      res.schema = arg2;
    } else if (arg2) {
      res.httpOptions = arg2;
    }

    if (arg3) {
      res.schema = arg3;
    }

    return res;
  }

  getJson<ResT>(url: string, options?: Opts): Promise<HttpResponse<ResT>>;
  getJson<ResT, Schema extends ZodType<ResT> = ZodType<ResT>>(
    url: string,
    schema: Schema
  ): Promise<HttpResponse<Infer<Schema>>>;
  getJson<ResT, Schema extends ZodType<ResT> = ZodType<ResT>>(
    url: string,
    options: Opts,
    schema: Schema
  ): Promise<HttpResponse<Infer<Schema>>>;
  getJson<ResT = unknown, Schema extends ZodType<ResT> = ZodType<ResT>>(
    arg1: string,
    arg2?: Opts | Schema,
    arg3?: Schema
  ): Promise<HttpResponse<ResT>> {
    const args = this.resolveArgs<ResT>(arg1, arg2, arg3);
    return this.requestJson<ResT>('get', args);
  }

  headJson(url: string, httpOptions?: Opts): Promise<HttpResponse<never>> {
    return this.requestJson<never>('head', { url, httpOptions });
  }

  postJson<T>(url: string, options?: Opts): Promise<HttpResponse<T>>;
  postJson<T, Schema extends ZodType<T> = ZodType<T>>(
    url: string,
    schema: Schema
  ): Promise<HttpResponse<Infer<Schema>>>;
  postJson<T, Schema extends ZodType<T> = ZodType<T>>(
    url: string,
    options: Opts,
    schema: Schema
  ): Promise<HttpResponse<Infer<Schema>>>;
  postJson<T = unknown, Schema extends ZodType<T> = ZodType<T>>(
    arg1: string,
    arg2?: Opts | Schema,
    arg3?: Schema
  ): Promise<HttpResponse<T>> {
    const args = this.resolveArgs(arg1, arg2, arg3);
    return this.requestJson<T>('post', args);
  }

  putJson<T>(url: string, options?: Opts): Promise<HttpResponse<T>>;
  putJson<T, Schema extends ZodType<T> = ZodType<T>>(
    url: string,
    schema: Schema
  ): Promise<HttpResponse<Infer<Schema>>>;
  putJson<T, Schema extends ZodType<T> = ZodType<T>>(
    url: string,
    options: Opts,
    schema: Schema
  ): Promise<HttpResponse<Infer<Schema>>>;
  putJson<T = unknown, Schema extends ZodType<T> = ZodType<T>>(
    arg1: string,
    arg2?: Opts | Schema,
    arg3?: ZodType
  ): Promise<HttpResponse<T>> {
    const args = this.resolveArgs(arg1, arg2, arg3);
    return this.requestJson<T>('put', args);
  }

  patchJson<T>(url: string, options?: Opts): Promise<HttpResponse<T>>;
  patchJson<T, Schema extends ZodType<T> = ZodType<T>>(
    url: string,
    schema: Schema
  ): Promise<HttpResponse<Infer<Schema>>>;
  patchJson<T, Schema extends ZodType<T> = ZodType<T>>(
    url: string,
    options: Opts,
    schema: Schema
  ): Promise<HttpResponse<Infer<Schema>>>;
  patchJson<T = unknown, Schema extends ZodType<T> = ZodType<T>>(
    arg1: string,
    arg2?: Opts | Schema,
    arg3?: Schema
  ): Promise<HttpResponse<T>> {
    const args = this.resolveArgs(arg1, arg2, arg3);
    return this.requestJson<T>('patch', args);
  }

  deleteJson<T>(url: string, options?: Opts): Promise<HttpResponse<T>>;
  deleteJson<T, Schema extends ZodType<T> = ZodType<T>>(
    url: string,
    schema: Schema
  ): Promise<HttpResponse<Infer<Schema>>>;
  deleteJson<T, Schema extends ZodType<T> = ZodType<T>>(
    url: string,
    options: Opts,
    schema: Schema
  ): Promise<HttpResponse<Infer<Schema>>>;
  deleteJson<T = unknown, Schema extends ZodType<T> = ZodType<T>>(
    arg1: string,
    arg2?: Opts | Schema,
    arg3?: Schema
  ): Promise<HttpResponse<T>> {
    const args = this.resolveArgs(arg1, arg2, arg3);
    return this.requestJson<T>('delete', args);
  }

  stream(url: string, options?: HttpOptions): NodeJS.ReadableStream {
    // TODO: fix types (#7154)
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
