// TODO: refactor code to remove this (#9651)
import './legacy';

import type { Options } from 'got';
import got, { RequestError } from 'got';
import type { SetRequired } from 'type-fest';
import { logger } from '../../logger';
import { coerceNumber } from '../number';
import { type HttpRequestStatsDataPoint, HttpStats } from '../stats';
import { coerceString } from '../string';
import { hooks } from './hooks';
import type { GotBufferOptions, GotOptions, HttpResponse } from './types';

export { RequestError } from 'got';

type QueueStatsData = Pick<HttpRequestStatsDataPoint, 'queueMs'>;

export async function fetch(
  url: string,
  options: SetRequired<GotOptions, 'method'>,
  queueStats: QueueStatsData,
): Promise<HttpResponse<unknown>> {
  logger.trace({ url, options }, 'got request');

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
  options: Omit<Options, 'isStream'>,
): NodeJS.ReadableStream {
  return got.stream(url, options);
}
