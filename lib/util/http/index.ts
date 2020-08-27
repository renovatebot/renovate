import crypto from 'crypto';
import URL from 'url';
import got, { Options, Response } from 'got';
import { HOST_DISABLED } from '../../constants/error-messages';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as memCache from '../cache/memory';
import { clone } from '../clone';
import { applyAuthorization, removeAuthorization } from './auth';
import { applyHostRules } from './host-rules';
import { getQueue } from './queue';
import { GotOptions } from './types';

// TODO: refactor code to remove this
import './legacy';

export * from './types';

interface OutgoingHttpHeaders {
  [header: string]: number | string | string[] | undefined;
}

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
}

function cloneResponse<T>(response: any): HttpResponse<T> {
  // clone body and headers so that the cached result doesn't get accidentally mutated
  return {
    statusCode: response.statusCode,
    body: clone<T>(response.body),
    headers: clone(response.headers),
  };
}

async function resolveResponse<T>(
  promisedRes: Promise<HttpResponse<T>>,
  { abortOnError, abortIgnoreStatusCodes }: GotOptions
): Promise<HttpResponse<T>> {
  try {
    const res = await promisedRes;
    return cloneResponse(res);
  } catch (err) {
    if (abortOnError && !abortIgnoreStatusCodes?.includes(err.statusCode)) {
      throw new ExternalHostError(err);
    }
    throw err;
  }
}

function applyDefaultHeaders(options: Options): void {
  // eslint-disable-next-line no-param-reassign
  options.headers = {
    // TODO: remove. Will be "gzip, deflate, br" by new got default
    'accept-encoding': 'gzip, deflate',
    ...options.headers,
    'user-agent':
      process.env.RENOVATE_USER_AGENT ||
      'https://github.com/renovatebot/renovate',
  };
}

async function gotTask<T>(
  url: string,
  options: GotOptions,
  startTime: number,
  queueTime: number
): Promise<Response<T>> {
  const resp = await got<T>(url, options);
  const duration = Date.now() - queueTime;
  const httpRequests = memCache.get('http-requests') || [];
  httpRequests.push({
    method: options.method,
    url,
    duration,
    queueDuration: queueTime - startTime,
  });
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
      url = URL.resolve(httpOptions.baseUrl, url);
    }
    // TODO: deep merge in order to merge headers
    let options: GotOptions = {
      method: 'get',
      ...this.options,
      hostType: this.hostType,
      ...httpOptions,
    } as unknown; // TODO: fixme
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

    // Cache GET requests unless useCache=false
    const cacheKey = crypto
      .createHash('md5')
      .update('got-' + JSON.stringify({ url, headers: options.headers }))
      .digest('hex');
    if (options.method === 'get' && options.useCache !== false) {
      // return from cache if present
      const cachedRes = memCache.get(cacheKey);
      // istanbul ignore if
      if (cachedRes) {
        return resolveResponse<T>(cachedRes, options);
      }
    }

    const startTime = Date.now();
    const queueTask = (): Promise<Response<T>> => {
      const queueTime = Date.now();
      return gotTask(url, options, startTime, queueTime);
    };

    const queue = getQueue(url);
    const promisedRes = queue ? queue.add(queueTask) : queueTask();

    if (options.method === 'get') {
      memCache.set(cacheKey, promisedRes); // always set if it's a get
    }
    const resp = await resolveResponse<T>(promisedRes, options);
    return resp;
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
      url = URL.resolve(options.baseUrl, url);
    }

    applyDefaultHeaders(combinedOptions);
    return got.stream(url, combinedOptions);
  }
}
