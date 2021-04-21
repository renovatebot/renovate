import crypto from 'crypto';
import merge from 'deepmerge';
import got, { Options, Response } from 'got';
import { HOST_DISABLED } from '../../constants/error-messages';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as memCache from '../cache/memory';
import { clone } from '../clone';
import { resolveBaseUrl } from '../url';
import { applyAuthorization, removeAuthorization } from './auth';
import { applyHostRules } from './host-rules';
import { getQueue } from './queue';
import type { GotOptions, OutgoingHttpHeaders, RequestStats } from './types';

// TODO: refactor code to remove this
import './legacy';

export interface HttpOptions {
  body?: any;
  username?: string;
  password?: string;
  baseUrl?: string;
  headers?: OutgoingHttpHeaders;
  throwHttpErrors?: boolean;
  useCache?: boolean;
}

export interface HttpPostOptions extends HttpOptions {
  body: unknown;
}

export interface InternalHttpOptions extends HttpOptions {
  json?: Record<string, unknown>;
  responseType?: 'json';
  method?: 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head';
}

export interface HttpResponse<T = string> {
  statusCode: number;
  body: T;
  headers: any;
  authorization?: boolean;
}

function cloneResponse<T>(response: any): HttpResponse<T> {
  // clone body and headers so that the cached result doesn't get accidentally mutated
  return {
    statusCode: response.statusCode,
    body: clone<T>(response.body),
    headers: clone(response.headers),
    authorization: !!response.authorization,
  };
}

function applyDefaultHeaders(options: Options): void {
  // eslint-disable-next-line no-param-reassign
  options.headers = {
    ...options.headers,
    'user-agent':
      process.env.RENOVATE_USER_AGENT ||
      'https://github.com/renovatebot/renovate',
  };
}

async function gotRoutine<T>(
  url: string,
  options: GotOptions,
  requestStats: Partial<RequestStats>
): Promise<Response<T>> {
  logger.trace({ url, options }, 'got request');

  const resp = await got<T>(url, options);
  const duration = resp.timings.phases.total || 0;

  const httpRequests = memCache.get('http-requests') || [];
  httpRequests.push({ ...requestStats, duration });
  memCache.set('http-requests', httpRequests);

  return resp;
}

export class Http<GetOptions = HttpOptions, PostOptions = HttpPostOptions> {
  constructor(private hostType: string, private options?: HttpOptions) {}

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
      .update('got-' + JSON.stringify({ url, headers: options.headers }))
      .digest('hex');

    let resPromise;

    // Cache GET requests unless useCache=false
    if (options.method === 'get' && options.useCache !== false) {
      resPromise = memCache.get(cacheKey);
    }

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

    // istanbul ignore else: needs test
    if (options?.baseUrl) {
      // eslint-disable-next-line no-param-reassign
      url = resolveBaseUrl(options.baseUrl, url);
    }

    applyDefaultHeaders(combinedOptions);
    return got.stream(url, combinedOptions);
  }
}
