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
      let authHeader = `Bearer ${options.token}`;
      if (options.hostType === 'github') {
        authHeader = `token ${options.token}`; // it seems to work with Bearer too, but docs say to use token
      }
      options.headers.authorization = authHeader; // eslint-disable-line no-param-reassign
      delete options.token; // eslint-disable-line no-param-reassign
    }
    return next(options);
  },
});
