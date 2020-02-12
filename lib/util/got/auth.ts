import got from 'got';
import { logger } from '../../logger';
import {
  PLATFORM_TYPE_GITHUB,
  PLATFORM_TYPE_GITLAB,
} from '../../constants/platforms';
import { RenovateGotOptions } from './types';

// istanbul ignore next
export default got.extend({
  handlers: [
    (options: RenovateGotOptions, next) => {
      if (options.auth || options.headers.authorization) {
        return next(options);
      }
      if (options.context?.token) {
        logger.trace(
          { hostname: options.hostname },
          'Converting token to Bearer auth'
        );
        if (options.context.hostType === PLATFORM_TYPE_GITHUB) {
          options.headers.authorization = `token ${options.context.token}`; // eslint-disable-line no-param-reassign
        } else if (options.context.hostType === PLATFORM_TYPE_GITLAB) {
          options.headers['Private-token'] = options.context?.token; // eslint-disable-line no-param-reassign
        } else {
          options.headers.authorization = `Bearer ${options.context.token}`; // eslint-disable-line no-param-reassign
        }
        delete options.context.token; // eslint-disable-line no-param-reassign
      }
      return next(options);
    },
  ],
});
