import got from 'got';

// Sets the user agent to be Renovate

export default got.extend({
  headers: {},
});
