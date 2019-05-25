const got = require('got');

// istanbul ignore next
module.exports = got.create({
  options: {},
  handler: (options, next) => {
    if (options.headers.authorization || options.auth) {
      return next(options);
    }
    if (options.token) {
      logger.trace(
        { hostname: options.hostname },
        'Converting token to Bearer auth'
      );
      options.headers.authorization = `Bearer ${options.token}`; // eslint-disable-line no-param-reassign
      delete options.token; // eslint-disable-line no-param-reassign
    }
    return next(options);
  },
});
