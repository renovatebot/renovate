import crypto from 'crypto';
import merge from 'deepmerge';
import got, { Options, Response } from 'got';
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
import type {
  GotJSONOptions,
  GotOptions,
  OutgoingHttpHeaders,
  RequestStats,
} from './types';

// TODO: refactor code to remove this (#9651)
import './legacy';

export interface HttpOptions {
  body?: any;
  username?: string;
  password?: string;
  baseUrl?: string;
  headers?: OutgoingHttpHeaders;

  /**
   * Do not use authentication
   */
  noAuth?: boolean;

  throwHttpErrors?: boolean;
  useCache?: boolean;
}

export interface HttpPostOptions extends HttpOptions {
  body: unknown;
}

export interface InternalHttpOptions extends HttpOptions {
  json?: Record<string, unknown>;
  responseType?: 'json' | 'buffer';
  method?: 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head';
}

export interface HttpResponse<T = string> {
  statusCode: number;
  body: T;
  headers: any;
  authorization?: boolean;
}

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
      process.env.RENOVATE_USER_AGENT ||
      `RenovateBot/${renovateVersion} (https://github.com/renovatebot/renovate)`,
  };
}

// Note on types:
// options.requestType can be either 'json' or 'buffer', but `T` should be
// `Buffer` in the latter case.
// We don't declare overload signatures because it's immediately wrapped by
// `request`.
async function gotRoutine<T>(
  url: string,
  options: GotOptions,
  requestStats: Partial<RequestStats>
): Promise<Response<T>> {
  logger.trace({ url, options }, 'got request');

  // Cheat the TS compiler using `as` to pick a specific overload.
  // Otherwise it doesn't typecheck.
  const resp = await got<T>(url, { ...options, hooks } as GotJSONOptions);
  const duration =
    resp.timings.phases.total || /* istanbul ignore next: can't be tested */ 0;

  const httpRequests = memCache.get('http-requests') || [];
  httpRequests.push({ ...requestStats, duration });
  memCache.set('http-requests', httpRequests);

  return resp;
}

export class Http<GetOptions = HttpOptions, PostOptions = HttpPostOptions> {
  private options?: GotOptions;

  constructor(private hostType: string, options?: HttpOptions) {
    this.options = merge<GotOptions>(options, { context: { hostType } });
  }

  protected async request<T>(
    requestUrl: string | URL,
    httpOptions?: InternalHttpOptions
  ): Promise<HttpResponse<T> | null> {
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
      throw new Error(HOST_DISABLED);
    }
    options = applyAuthorization(options);

    const cacheKey = crypto
      .createHash('md5')
      .update(
        'got-' +
          JSON.stringify({
            url,
            headers: options.headers,
            method: options.method,
          })
      )
      .digest('hex');

    let resPromise;

    // Cache GET requests unless useCache=false
    if (
      ['get', 'head'].includes(options.method) &&
      options.useCache !== false
    ) {
      resPromise = memCache.get(cacheKey);
    }

    // istanbul ignore else: no cache tests
    if (!resPromise) {
      const startTime = Date.now();
      const queueTask = (): Promise<Response<T>> => {
        const queueDuration = Date.now() - startTime;
        return gotRoutine(url, options, {
          method: options.method,
          url,
          queueDuration,
        });
      };
      const queue = getQueue(url);
      resPromise = queue?.add(queueTask) ?? queueTask();
      if (options.method === 'get') {
        memCache.set(cacheKey, resPromise); // always set if it's a get
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

  private async requestJson<T = unknown>(
    url: string,
    options: InternalHttpOptions
  ): Promise<HttpResponse<T>> {
    const { body, ...jsonOptions } = options;
    if (body) {
      jsonOptions.json = body;
    }
    const res = await this.request<T>(url, {
      ...jsonOptions,
      responseType: 'json',
    });
    return { ...res, body: res.body };
  }

  getJson<T = unknown>(
    url: string,
    options?: GetOptions
  ): Promise<HttpResponse<T>> {
    return this.requestJson<T>(url, { ...options });
  }

  headJson<T = unknown>(
    url: string,
    options?: GetOptions
  ): Promise<HttpResponse<T>> {
    return this.requestJson<T>(url, { ...options, method: 'head' });
  }

  postJson<T = unknown>(
    url: string,
    options?: PostOptions
  ): Promise<HttpResponse<T>> {
    return this.requestJson<T>(url, { ...options, method: 'post' });
  }

  putJson<T = unknown>(
    url: string,
    options?: PostOptions
  ): Promise<HttpResponse<T>> {
    return this.requestJson<T>(url, { ...options, method: 'put' });
  }

  patchJson<T = unknown>(
    url: string,
    options?: PostOptions
  ): Promise<HttpResponse<T>> {
    return this.requestJson<T>(url, { ...options, method: 'patch' });
  }

  deleteJson<T = unknown>(
    url: string,
    options?: PostOptions
  ): Promise<HttpResponse<T>> {
    return this.requestJson<T>(url, { ...options, method: 'delete' });
  }

  stream(url: string, options?: HttpOptions): NodeJS.ReadableStream {
    const combinedOptions: any = {
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
    return got.stream(resolvedUrl, combinedOptions);
  }
}
