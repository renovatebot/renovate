import got from 'got';
import { logger } from '../../logger';
import {
  PLATFORM_TYPE_GITHUB,
  PLATFORM_TYPE_GITLAB,
} from '../../constants/platforms';

// istanbul ignore next
export default got.extend({
  handlers: [
    (options, next) => {
      if (options.auth || options.headers.authorization) {
        return next(options);
      }
      if (options.token) {
        logger.trace(
          { hostname: options.hostname },
          'Converting token to Bearer auth'
        );
        if (options.hostType === PLATFORM_TYPE_GITHUB) {
          options.headers.authorization = `token ${options.token}`; // eslint-disable-line no-param-reassign
        } else if (options.hostType === PLATFORM_TYPE_GITLAB) {
          options.headers['Private-token'] = options.token; // eslint-disable-line no-param-reassign
        } else {
          options.headers.authorization = `Bearer ${options.token}`; // eslint-disable-line no-param-reassign
        }
        delete options.token; // eslint-disable-line no-param-reassign
      }
      return next(options);
    },
  ],
});
