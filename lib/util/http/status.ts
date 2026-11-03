import { isNumber } from '@sindresorhus/is';

/** 200 OK */
export function isOk(statusCode?: number): boolean {
  return statusCode === 200;
}

/** 204 No Content */
export function isNoContent(statusCode?: number): boolean {
  return statusCode === 204;
}

/** 300 Multiple Choices */
export function isMultipleChoices(statusCode?: number): boolean {
  return statusCode === 300;
}

/** 304 Not Modified */
export function isNotModified(statusCode?: number): boolean {
  return statusCode === 304;
}

/** 400 Bad Request */
export function isBadRequest(statusCode?: number): boolean {
  return statusCode === 400;
}

/** 401 Unauthorized */
export function isUnauthorized(statusCode?: number): boolean {
  return statusCode === 401;
}

/** 403 Forbidden */
export function isForbidden(statusCode?: number): boolean {
  return statusCode === 403;
}

/** 404 Not Found */
export function isNotFound(statusCode?: number): boolean {
  return statusCode === 404;
}

/** 405 Method Not Allowed */
export function isMethodNotAllowed(statusCode?: number): boolean {
  return statusCode === 405;
}

/** 406 Not Acceptable */
export function isNotAcceptable(statusCode?: number): boolean {
  return statusCode === 406;
}

/** 409 Conflict */
export function isConflict(statusCode?: number): boolean {
  return statusCode === 409;
}

/** 410 Gone */
export function isGone(statusCode?: number): boolean {
  return statusCode === 410;
}

/** 422 Unprocessable Content */
export function isUnprocessableContent(statusCode?: number): boolean {
  return statusCode === 422;
}

/** 429 Too Many Requests */
export function isRateLimited(statusCode?: number): boolean {
  return statusCode === 429;
}

/** 502 Bad Gateway */
export function isBadGateway(statusCode?: number): boolean {
  return statusCode === 502;
}

/** 503 Service Unavailable */
export function isServiceUnavailable(statusCode?: number): boolean {
  return statusCode === 503;
}

/** 4xx */
export function isClientError(statusCode?: number): boolean {
  return isNumber(statusCode) && statusCode >= 400 && statusCode < 500;
}

/** 5xx */
export function isServerError(statusCode?: number): boolean {
  return isNumber(statusCode) && statusCode >= 500 && statusCode < 600;
}

/** 429 or 5xx, i.e. a failure on the host's side which a later request may not hit */
export function isRateLimitedOrServerError(statusCode?: number): boolean {
  return isRateLimited(statusCode) || isServerError(statusCode);
}
