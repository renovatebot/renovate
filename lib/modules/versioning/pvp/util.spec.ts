import { extractAllComponents, getComponents } from './util';

describe('modules/versioning/pvp/util', () => {
  describe('.extractAllComponents(version)', () => {
    it('should return null when there are no numbers', () => {
      expect(extractAllComponents('')).toBeNull();
    });

    it('should parse 3.0', () => {
      expect(extractAllComponents('3.0')).toEqual([3, 0]);
    });
  });

  describe('.getComponents(...)', () => {
    it('"0" is valid major version', () => {
      expect(getComponents('0')?.major).toEqual([0]);
    });

    it('returns null when no components could be extracted', () => {
      expect(getComponents('')).toBeNull();
    });
  });
});
