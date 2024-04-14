import { clone } from '../clone';
import type { HttpResponse } from './types';

// Copying will help to avoid circular structure
// and mutation of the cached response.
export function copyResponse<T>(
  response: HttpResponse<T>,
  deep: boolean,
): HttpResponse<T> {
  const { body, statusCode, headers } = response;
  return deep
    ? {
        statusCode,
        body: body instanceof Buffer ? (body.subarray() as T) : clone<T>(body),
        headers: clone(headers),
      }
    : {
        statusCode,
        body,
        headers,
      };
}
