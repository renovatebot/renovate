import got from 'got';

// Sets the user agent to be Renovate

export default got.extend({
  headers: {
    'user-agent':
      process.env.RENOVATE_USER_AGENT ||
      'https://github.com/renovatebot/renovate',
  },
});
