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
    res.body = body instanceof Buffer ? (body.subarray() as T) : clone<T>(body);
  }

  if (cached) {
    res.cached = true;
  }

  return res;
}
