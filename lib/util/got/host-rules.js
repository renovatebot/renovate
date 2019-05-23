const got = require('got');
const hostRules = require('../host-rules');

// Apply host rules to requests

// istanbul ignore next
module.exports = got.create({
  options: {
    // TODO: Move to configurable host rules
    timeout: 60 * 1000,
  },
  handler: (options, next) => {
    const { hostType, ...opts } = options;
    if (!options.hostname) {
      return next(opts);
    }
    const hostRule = hostRules.find({
      hostType,
      url: options.url, // TODO: check this
    });
    if (!hostRule) {
      return next(opts);
    }
    if (!options.headers.authorization) {
      if (hostRule.password) {
        logger.debug(
          'Applying Basic authentication for host ' + options.hostname
        );
        const auth = Buffer.from(
          `${hostRule.username || ''}:${hostRule.password}`
        ).toString('base64');
        opts.headers.authorization = `Basic ${auth}`;
      } else if (hostRule.token) {
        logger.debug(
          'Applying Bearer authentication for host ' + options.hostname
        );
        opts.headers.authorization = `Bearer ${hostRule.token}`;
      }
    }
    // TODO: apply other options/headers
    // istanbul ignore next
    return next(opts);
  },
});
