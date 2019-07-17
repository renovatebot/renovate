/* eslint-disable no-param-reassign */
const got = require('got');
const { logger } = require('../../logger');
const hostRules = require('../host-rules');

// Apply host rules to requests

// istanbul ignore next
// @ts-ignore
module.exports = got.create({
  options: {},
  handler: (options, next) => {
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
