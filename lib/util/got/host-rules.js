const got = require('got');
const hostRules = require('../host-rules');

// Apply host rules to requests

// istanbul ignore next
module.exports = got.create({
  options: {},
  handler: (options, next) => {
    const { hostType, ...opts } = options;
    if (!options.hostname) {
      return next(opts);
    }
    const { username = '', password, token, timeout } = hostRules.find({
      hostType,
      url: options.href,
    });
    if (opts.headers.authorization || opts.auth || opts.token) {
      logger.debug('Authorization already set for host: ' + opts.hostname);
    } else if (password) {
      logger.debug('Applying Basic authentication for host ' + opts.hostname);
      opts.auth = `${username}:${password}`;
    } else if (token) {
      logger.debug('Applying Bearer authentication for host ' + opts.hostname);
      opts.token = token;
    }
    if (timeout) {
      opts.timeout = timeout;
    }
    return next(opts);
  },
});
