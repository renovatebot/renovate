import { formatValidationMessages, getParentName } from './utils.ts';

describe('config/validation-helpers/utils', () => {
  describe('getParentName()', () => {
    it('ignores encrypted in root', () => {
      expect(getParentName('encrypted')).toBeEmptyString();
    });

    it('handles array types', () => {
      expect(getParentName('hostRules[1]')).toBe('hostRules');
    });

    it('handles encrypted within array types', () => {
      expect(getParentName('hostRules[0].encrypted')).toBe('hostRules');
    });
  });

  describe('formatValidationMessages()', () => {
    it('returns a single message as-is', () => {
      expect(formatValidationMessages(['a, b'])).toBe('a, b');
    });

    it('formats several messages as a Markdown list', () => {
      expect(formatValidationMessages(['a, b', 'c'])).toBe('- a, b\n- c');
    });
  });
});
