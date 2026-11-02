import { formatMarkdownList } from './markdown-list.ts';

describe('util/markdown-list', () => {
  describe('formatMarkdownList()', () => {
    it('indents further lines of an item, so they stay within it', () => {
      expect(formatMarkdownList(['a\n\nb\n- c', 'd'])).toBe(
        '- a\n\n  b\n  - c\n- d',
      );
    });
  });
});
