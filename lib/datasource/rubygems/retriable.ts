import {
  RetryFunction,
  RetryObject,
  HTTPError,
  ParseError,
  MaxRedirectsError,
} from 'got';
import { logger } from '../../logger';
import {
  UNAUTHORIZED,
  FORBIDDEN,
  REQUEST_TIMEOUT,
  TOO_MANY_REQUEST,
  SERVICE_UNAVAILABLE,
} from './errors';

const DEFAULT_BANNED_RETRY_AFTER = 600;
const NUMBER_OF_RETRIES = 2;

const getBannedDelay = (retryAfter: string): number =>
  (parseInt(retryAfter, 10) || DEFAULT_BANNED_RETRY_AFTER) + 1;
const getDefaultDelay = (count: number): number =>
  +(NUMBER_OF_RETRIES / count).toFixed(3);

const getErrorMessage = (status: number): string => {
  // istanbul ignore next
  switch (status) {
    case UNAUTHORIZED:
    case FORBIDDEN:
      return `RubyGems registry: Authentication failed.`;
    case TOO_MANY_REQUEST:
      return `RubyGems registry: Too Many Requests.`;
    case REQUEST_TIMEOUT:
    case SERVICE_UNAVAILABLE:
      return `RubyGems registry: Temporary Unavailable`;
    default:
      return `RubyGems registry: Internal Server Error`;
  }
};

const isErrorWithResponse = (
  error: RetryObject['error']
): error is HTTPError | ParseError | MaxRedirectsError =>
  error instanceof HTTPError ||
  error instanceof ParseError ||
  error instanceof MaxRedirectsError;

export default (numberOfRetries = NUMBER_OF_RETRIES): RetryFunction => ({
  error,
}): number => {
  if (numberOfRetries === 0 || !isErrorWithResponse(error)) {
    return 0;
  }

  const { response } = error;
  const { headers, statusCode } = response;

  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After
  const isBanned = [TOO_MANY_REQUEST, SERVICE_UNAVAILABLE].includes(statusCode);
  const delaySec = isBanned
    ? getBannedDelay(headers['retry-after'])
    : getDefaultDelay(numberOfRetries);

  // eslint-disable-next-line
  numberOfRetries--;

  const errorMessage = getErrorMessage(statusCode);
  const message = `${errorMessage} Retry in ${delaySec} seconds.`;

  logger.info(message);

  return delaySec * 1000;
};
