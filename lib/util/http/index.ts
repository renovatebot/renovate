import merge from 'deepmerge';
import got, { Options, RequestError, Response } from 'got';
import hasha from 'hasha';
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
  HttpOptions,
  HttpPostOptions,
  HttpResponse,
  InternalHttpOptions,
  RequestStats,
} from './types';
// TODO: refactor code to remove this (#9651)
import './legacy';

export { RequestError as HttpError };

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
async function gotRoutine<T>(
  url: string,
  options: GotOptions,
  requestStats: Omit<RequestStats, 'duration' | 'statusCode'>
): Promise<Response<T>> {
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
        /* istanbul ignore next: can't be tested */ 0;
      duration =
        error.timings?.phases.total ??
        /* istanbul ignore next: can't be tested */ 0;
    }

    throw error;
  } finally {
    const httpRequests = memCache.get<RequestStats[]>('http-requests') || [];
    httpRequests.push({ ...requestStats, duration, statusCode });
    memCache.set('http-requests', httpRequests);
  }
}

export class Http<GetOptions = HttpOptions, PostOptions = HttpPostOptions> {
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
      logger.debug({ url }, 'Host is disabled - rejecting request');
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
    let resPromise;

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
      const queueTask = (): Promise<Response<T>> => {
        const queueDuration = Date.now() - startTime;
        return gotRoutine(url, options, {
          method: options.method ?? 'get',
          url,
          queueDuration,
        });
      };
      const queue = getQueue(url);
      resPromise = queue?.add(queueTask) ?? queueTask();
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
