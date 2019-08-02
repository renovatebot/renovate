import got from 'got';
import { logger } from '../../logger';
import {
  UNAUTHORIZED,
  FORBIDDEN,
  REQUEST_TIMEOUT,
  TOO_MANY_REQUEST,
  SERVICE_UNAVAILABLE,
} from './errors';

const RETRY_AFTER = 600;
const NUMBER_OF_RETRIES = 5;

const getDelayStep = () =>
  parseInt(process.env.RENOVATE_RUBYGEMS_RETRY_DELAY_STEP || '1000', 10);

const toMs = (value: number) => value * getDelayStep();
const getBannedDelay = (retryAfter: string) =>
  (parseInt(retryAfter, 10) || RETRY_AFTER) + 1;
const getDefaultDelay = (count: number) =>
  (NUMBER_OF_RETRIES * getDelayStep()) / count;

const getDelayMessage = (delay: any) => `Retry in ${delay} seconds.`;
const getErrorMessage = (status: number) => {
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
) => {
  if (numberOfRetries === 0) {
    return 0;
  }

  const { headers, statusCode } = err;
  const isBanned = [TOO_MANY_REQUEST, SERVICE_UNAVAILABLE].includes(statusCode);
  const delay = isBanned
    ? getBannedDelay(headers['retry-after'])
    : getDefaultDelay(numberOfRetries);

  // eslint-disable-next-line
  numberOfRetries--;

  const errorMessage = getErrorMessage(statusCode);
  const delayMessage = getDelayMessage(delay);
  const message = `${errorMessage} ${delayMessage}`;

  logger.info(message);

  return toMs(delay);
};
