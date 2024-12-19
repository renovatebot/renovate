import { getParentName } from './utils';

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
});
