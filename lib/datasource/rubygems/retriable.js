const {
  UNAUTHORIZED,
  FORBIDDEN,
  REQUEST_TIMEOUT,
  TOO_MANY_REQUEST,
  SERVICE_UNAVAILABLE,
} = require('./errors');

const RETRY_AFTER = 600;
const NUMBER_OF_RETRIES = 5;

const getDelayStep = () =>
  process.env.RENOVATE_RUBYGEMS_RETRY_DELAY_STEP || 1000;

const toMs = value => parseInt(value, 10) * getDelayStep();
const getBannedDelay = retryAfter => (retryAfter || RETRY_AFTER) + 1;
const getDefaultDelay = count => (NUMBER_OF_RETRIES * getDelayStep()) / count;

const getDelayMessage = delay => `Retry in ${delay} seconds.`;
const getErrorMessage = status => {
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

module.exports = (numberOfRetries = NUMBER_OF_RETRIES) => (_, err) => {
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
