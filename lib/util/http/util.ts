import { HOST_BLOCKED } from '../../constants/error-messages.ts';
import { clone } from '../clone.ts';
import type { HttpResponse } from './types.ts';

// Copying will help to avoid circular structure
// and mutation of the cached response.
export function copyResponse<T>(
  { statusCode, headers, body, cached }: HttpResponse<T>,
  deep: boolean,
): HttpResponse<T> {
  const res: HttpResponse<T> = { statusCode, headers, body };

  if (deep) {
    res.headers = clone(headers);
    res.body =
      body instanceof Uint8Array ? (body.subarray() as T) : clone<T>(body);
  }

  if (cached) {
    res.cached = true;
  }

  return res;
}

/**
 * The log message for a request the HTTP layer refused, distinguishing a host blocked by the internal-host policy from one an administrator disabled.
 *
 * Both are reported the same way by their callers - traced and swallowed - so only the wording tells them apart in the logs.
 */
export function refusedHostMessage(err: Error): string {
  return err.message === HOST_BLOCKED ? 'Host blocked' : 'Host disabled';
}
