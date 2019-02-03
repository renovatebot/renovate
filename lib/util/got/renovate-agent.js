const got = require('got');

// Sets the user agent to be Renovate

module.exports = got.extend({
  headers:
    process.env.RENOVATE_USER_AGENT ||
    'https://github.com/renovatebot/renovate',
});
