import { isNumber, isObject } from '@sindresorhus/is';

interface WithResponse {
  response?: { statusCode?: number };
}

/** A status code, a response which may carry one, or an error such as `HttpError` whose response may carry one */
export type StatusSource = number | { statusCode?: number } | WithResponse;

function hasResponse(
  source: Exclude<StatusSource, number>,
): source is WithResponse {
  return 'response' in source;
}

function getStatusCode(source?: StatusSource): number | undefined {
  if (isNumber(source)) {
    return source;
  }
  // callers pass caught errors, which may be any thrown value
  if (!isObject(source)) {
    return undefined;
  }
  return hasResponse(source) ? source.response?.statusCode : source.statusCode;
}

/** 200 OK */
export function isOk(source?: StatusSource): boolean {
  return getStatusCode(source) === 200;
}

/** 204 No Content */
export function isNoContent(source?: StatusSource): boolean {
  return getStatusCode(source) === 204;
}

/** 300 Multiple Choices */
export function isMultipleChoices(source?: StatusSource): boolean {
  return getStatusCode(source) === 300;
}

/** 304 Not Modified */
export function isNotModified(source?: StatusSource): boolean {
  return getStatusCode(source) === 304;
}

/** 400 Bad Request */
export function isBadRequest(source?: StatusSource): boolean {
  return getStatusCode(source) === 400;
}

/** 401 Unauthorized */
export function isUnauthorized(source?: StatusSource): boolean {
  return getStatusCode(source) === 401;
}

/** 403 Forbidden */
export function isForbidden(source?: StatusSource): boolean {
  return getStatusCode(source) === 403;
}

/** 404 Not Found */
export function isNotFound(source?: StatusSource): boolean {
  return getStatusCode(source) === 404;
}

/** 405 Method Not Allowed */
export function isMethodNotAllowed(source?: StatusSource): boolean {
  return getStatusCode(source) === 405;
}

/** 406 Not Acceptable */
export function isNotAcceptable(source?: StatusSource): boolean {
  return getStatusCode(source) === 406;
}

/** 409 Conflict */
export function isConflict(source?: StatusSource): boolean {
  return getStatusCode(source) === 409;
}

/** 410 Gone */
export function isGone(source?: StatusSource): boolean {
  return getStatusCode(source) === 410;
}

/** 416 Range Not Satisfiable */
export function isRangeNotSatisfiable(source?: StatusSource): boolean {
  return getStatusCode(source) === 416;
}

/** 422 Unprocessable Content */
export function isUnprocessableContent(source?: StatusSource): boolean {
  return getStatusCode(source) === 422;
}

/** 429 Too Many Requests */
export function isRateLimited(source?: StatusSource): boolean {
  return getStatusCode(source) === 429;
}

/** 502 Bad Gateway */
export function isBadGateway(source?: StatusSource): boolean {
  return getStatusCode(source) === 502;
}

/** 503 Service Unavailable */
export function isServiceUnavailable(source?: StatusSource): boolean {
  return getStatusCode(source) === 503;
}

/** 4xx */
export function isClientError(source?: StatusSource): boolean {
  const statusCode = getStatusCode(source);
  return isNumber(statusCode) && statusCode >= 400 && statusCode < 500;
}

/** 5xx */
export function isServerError(source?: StatusSource): boolean {
  const statusCode = getStatusCode(source);
  return isNumber(statusCode) && statusCode >= 500 && statusCode < 600;
}

/** 429 or 5xx, i.e. a failure on the host's side which a later request may not hit */
export function isRateLimitedOrServerError(source?: StatusSource): boolean {
  return isRateLimited(source) || isServerError(source);
}
