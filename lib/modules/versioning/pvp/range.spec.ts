import { parseRange } from './range';

describe('modules/versioning/pvp/range', () => {
  describe('.parseRange(range)', () => {
    it('should parse >=1.0 && <1.1', () => {
      const parsed = parseRange('>=1.0 && <1.1');
      expect(parsed).not.toBeNull();
      expect(parsed!.lower).toBe('1.0');
      expect(parsed!.upper).toBe('1.1');
    });
  });
});
