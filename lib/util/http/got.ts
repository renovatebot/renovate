// TODO: refactor code to remove this (#9651)
import './legacy.ts';

import { isNumber } from '@sindresorhus/is';
import type { OptionsInit } from 'got';
import { RequestError, got } from 'got';
import type { SetRequired } from 'type-fest';
import { logger } from '../../logger/index.ts';
import { coerceNumber } from '../number.ts';
import { type HttpRequestStatsDataPoint, HttpStats } from '../stats.ts';
import { coerceString } from '../string.ts';
import { hooks } from './hooks.ts';
import {
  type GotBufferOptions,
  GotExtraOptionKeys,
  type GotOptions,
  type HttpResponse,
} from './types.ts';

export { RequestError } from 'got';

type QueueStatsData = Pick<HttpRequestStatsDataPoint, 'queueMs'>;

export function configureRejectUnauth(options: OptionsInit): void {
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    logger.once.warn(
      'NODE_TLS_REJECT_UNAUTHORIZED=0 found, this is strongly discouraged.',
    );
    options.https = { ...options.https, rejectUnauthorized: false };
  }
}

export async function fetch(
  url: string,
  options: SetRequired<GotOptions, 'method'>,
  queueStats: QueueStatsData,
): Promise<HttpResponse<unknown>> {
  logger.trace({ url, options }, 'got request');
  configureRejectUnauth(options);

  let duration = 0;
  let statusCode = 0;
  try {
    // Cheat the TS compiler using `as` to pick a specific overload.
    // Otherwise it doesn't typecheck.
    const resp = await got(url, { ...options, hooks } as GotBufferOptions);
    statusCode = resp.statusCode;
    duration = coerceNumber(resp.timings.phases.total, 0);
    return resp;
  } catch (error) {
    // v8 ignore else -- TODO: add test #40625
    if (error instanceof RequestError) {
      statusCode = coerceNumber(error.response?.statusCode, -1);
      duration = coerceNumber(error.timings?.phases.total, -1);
      const method = options.method.toUpperCase();
      const code = coerceString(error.code, 'UNKNOWN');
      const retryCount = coerceNumber(error.request?.retryCount, -1);
      logger.debug(
        `${method} ${url} = (code=${code}, statusCode=${statusCode} retryCount=${retryCount}, duration=${duration})`,
      );
    }

    throw error;
    /* v8 ignore next: 🐛 https://github.com/bcoe/c8/issues/229 */
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

export function stream(
  url: string,
  options: Omit<OptionsInit, 'isStream'>,
): NodeJS.ReadableStream {
  configureRejectUnauth(options);
  return got.stream(url, options);
}

/**
 * Removes non-got options and normalizes some options to match got's expected format.
 * @param options options to normalize
 * @returns normalized got options
 */
export function normalize<T extends OptionsInit = OptionsInit>(
  options: T,
  keysToRemove: readonly string[],
): T {
  // flat copy to void mutating the original options object
  const opts = { ...options };

  for (const key of [...GotExtraOptionKeys, ...keysToRemove]) {
    // @ts-expect-error -- delete extra options before passing to got
    delete opts[key];
  }

  // optimize options for got v12+
  if (isNumber(opts.timeout)) {
    opts.timeout = { request: opts.timeout };
  }

  return opts;
}
