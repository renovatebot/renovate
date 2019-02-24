const { maskToken } = require('../../lib/util/mask');

describe('util/mask', () => {
  describe('.maskToken', () => {
    it('returns value if passed value is falsy', () => {
      expect(maskToken('')).toEqual('');
    });

    it('hides value content', () => {
      expect(maskToken('123456789')).toEqual('12*****89');
    });
  });
});
