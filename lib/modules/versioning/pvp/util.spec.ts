import { extractAllParts, getParts } from './util';

describe('modules/versioning/pvp/util', () => {
  describe('.extractAllParts(version)', () => {
    it('should return null when there are no numbers', () => {
      expect(extractAllParts('')).toBeNull();
    });

    it('should parse 3.0', () => {
      expect(extractAllParts('3.0')).toEqual([3, 0]);
    });
  });

  describe('.getParts(...)', () => {
    it('"0" is valid major version', () => {
      expect(getParts('0')?.major).toEqual([0]);
    });

    it('returns null when no parts could be extracted', () => {
      expect(getParts('')).toBeNull();
    });
  });
});
