import {
  init,
  getLimitRemaining,
  incrementLimit,
} from '../../../lib/workers/global/limits';

describe('lib/workers/global/limits', () => {
  describe('init()', () => {
    it('check defined variables have a value set to zero', () => {
      const config = { prCommitsPerRunLimit: 3 };
      init(config);
      const result = getLimitRemaining('prCommitsPerRunLimit');
      expect(result).toEqual(3);
    });
  });
  describe('incrementLimit()', () => {
    it('check increment works as expected', () => {
      const config = { prCommitsPerRunLimit: 3 };
      init(config);
      incrementLimit('prCommitsPerRunLimit', 2);
      const result = getLimitRemaining('prCommitsPerRunLimit');
      expect(result).toEqual(1);
    });
  });
});
