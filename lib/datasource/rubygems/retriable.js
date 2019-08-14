const { logger } = require('../../logger');
const {
  UNAUTHORIZED,
  FORBIDDEN,
  REQUEST_TIMEOUT,
  TOO_MANY_REQUEST,
  SERVICE_UNAVAILABLE,
} = require('./errors');

const DEFAULT_BANNED_RETRY_AFTER = 600;
const NUMBER_OF_RETRIES = parseInt(
  process.env.RENOVATE_RUBYGEMS_REQUEST_RETRIES || '2',
  10
);

const getBannedDelay = retryAfter =>
  (parseInt(retryAfter, 10) || DEFAULT_BANNED_RETRY_AFTER) + 1;
const getDefaultDelay = count => +(NUMBER_OF_RETRIES / count).toFixed(3);

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
