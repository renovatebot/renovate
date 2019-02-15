const got = require('got');

// Sets the user agent to be Renovate

module.exports = got.extend({
  headers: {
    'user-agent':
      process.env.RENOVATE_USER_AGENT ||
      'https://github.com/renovatebot/renovate',
  },
});
