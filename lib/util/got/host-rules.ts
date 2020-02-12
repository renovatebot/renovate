/* eslint-disable no-param-reassign */
import got from 'got';
import { logger } from '../../logger';
import * as hostRules from '../host-rules';
import { RenovateGotOptions } from './types';

// Apply host rules to requests

// istanbul ignore next
export default got.extend({
  handlers: [
    (options: RenovateGotOptions, next) => {
      if (!options.hostname) {
        return next(options);
      }
      const { username, password, token, timeout } = hostRules.find({
        hostType: (options as any).hostType,
        url: options.href,
      });
      if (
        options.headers.authorization ||
        options.auth ||
        options.context.token
      ) {
        logger.trace('Authorization already set for host: ' + options.hostname);
      } else if (password) {
        logger.trace(
          'Applying Basic authentication for host ' + options.hostname
        );
        options.auth = `${username || ''}:${password}`;
      } else if (token) {
        logger.trace(
          'Applying Bearer authentication for host ' + options.hostname
        );
        options.context.token = token;
      }
      if (timeout) {
        options.timeout = { request: timeout };
      }
      return next(options);
    },
  ],
});
