import { getName } from '../../../test/util';
import { skip } from './util';

describe(getName(__filename), () => {
  describe('skip()', () => {
    it('handles out of bounds case', () => {
      const content = 'some content';
      const idx = content.length * 2;
      expect(skip(idx, content, (c) => c === '!')).toBe(idx);
    });
  });
});
