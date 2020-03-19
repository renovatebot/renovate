/* eslint-disable no-param-reassign */
import { logger } from '../../logger';
import * as hostRules from '../host-rules';
import { create } from './util';

// Apply host rules to requests

export default create({
  options: {},
  handler: (options, next) => {
    // istanbul ignore if: never happen?
    if (!options.hostname) {
      return next(options);
    }
    const { username, password, token, timeout } = hostRules.find({
      hostType: options.hostType,
      url: options.href,
    });
    if (options.headers.authorization || options.auth || options.token) {
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
      options.token = token;
    }
    if (timeout) {
      options.gotTimeout = { request: timeout };
    }
    return next(options);
  },
});
