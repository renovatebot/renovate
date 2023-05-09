// DO NOT USE IT without reason - NodeJS is asynchronous by nature, and we should keep it that way

import type { Options } from 'sync-request';
import request from 'sync-request';
import { logger } from '../../logger';

const MAX_TIMEOUT_IN_MILLIS = 3 * 1000; // 3s
const ENCODING = 'utf-8';

export function executeSynchronousGetRequest(
  url: URL | null,
  options?: Options
): string | null {
  if (!url) {
    return null;
  }
  try {
    return request('GET', url, {
      timeout: MAX_TIMEOUT_IN_MILLIS,
      socketTimeout: MAX_TIMEOUT_IN_MILLIS,
      ...options,
    }).getBody(ENCODING);
  } catch (e: unknown) {
    logger.debug(`Error when executing synchronous get request to ${url.href}`);
    return null;
  }
}
