const got = require('got');

// istanbul ignore next
module.exports = got.create({
  options: {},
  handler: (options, next) => {
    if (options.auth || options.headers.authorization) {
      return next(options);
    }
    if (options.token) {
      logger.trace(
        { hostname: options.hostname },
        'Converting token to Bearer auth'
      );
      if (options.hostType === 'github') {
        options.headers.authorization = `token ${options.token}`; // eslint-disable-line no-param-reassign
      } else if (options.hostType === 'gitlab') {
        options.headers['Private-token'] = options.token; // eslint-disable-line no-param-reassign
      } else {
        options.headers.authorization = `Bearer ${options.token}`; // eslint-disable-line no-param-reassign
      }
      delete options.token; // eslint-disable-line no-param-reassign
    }
    return next(options);
  },
});
