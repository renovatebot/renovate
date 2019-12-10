import got from 'got';
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

// TODO: workaround because got does not export HTTPError, should be moved to `lib/util/got`
export type HTTPError = InstanceType<got.GotInstance['HTTPError']>;

export default (numberOfRetries = NUMBER_OF_RETRIES): got.RetryFunction => (
  _?: number,
  err?: Partial<HTTPError>
): number => {
  if (numberOfRetries === 0) {
    return 0;
  }

  const { headers, statusCode } = err;

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
