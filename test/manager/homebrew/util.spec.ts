import { skip } from '../../../lib/manager/homebrew/util';

describe('lib/manager/homebrew/util', () => {
  describe('skip()', () => {
    it('handles out of bounds case', () => {
      const content = 'some content';
      const idx = content.length * 2;
      expect(skip(idx, content, c => c === '!')).toBe(idx);
    });
  });
});
