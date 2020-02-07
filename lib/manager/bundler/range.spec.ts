import { getRangeStrategy } from '.';

describe('lib/manager/bundler/range', () => {
  describe('getRangeStrategy()', () => {
    it('always returns replace', () => {
      expect(getRangeStrategy()).toEqual('replace');
    });
  });
});
