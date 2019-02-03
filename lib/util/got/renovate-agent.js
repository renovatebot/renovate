const got = require('got');

module.exports = got.extend({
  headers:
    process.env.RENOVATE_USER_AGENT ||
    'https://github.com/renovatebot/renovate',
});
