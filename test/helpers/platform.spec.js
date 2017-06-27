const platformHelper = require('../../lib/helpers/platform');

describe('helpers/platform', () => {
  describe('getApi(platform)', () => {
    it('returns github', () => {
      platformHelper.getApi('github');
    });
    it('returns gitlab', () => {
      platformHelper.getApi('gitlab');
    });
    it('throws error', () => {
      let e;
      try {
        platformHelper.getApi('foo');
      } catch (err) {
        e = err;
      }
      expect(e).toMatchSnapshot();
    });
  });
});
