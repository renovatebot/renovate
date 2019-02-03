const crypto = require('crypto');
const got = require('got');

const create = () =>
  got.create({
    options: got.mergeOptions(got.defaults.options, {
      headers: {
        'user-agent':
          process.env.RENOVATE_USER_AGENT ||
          'https://github.com/renovatebot/renovate',
      },
    }),

    methods: got.defaults.methods,

    handler: (options, next) => {
      if (options.method === 'GET') {
        const cacheKey = crypto
          .createHash('md5')
          .update('got-' + options.href + JSON.stringify(options.headers))
          .digest('hex');
        if (!global.repoCache[cacheKey]) {
          global.repoCache[cacheKey] = next(options);
        }
        return global.repoCache[cacheKey];
      }
      return next(options);
    },
  });

module.exports = create();
