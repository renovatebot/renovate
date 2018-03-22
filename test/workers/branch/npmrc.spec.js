const npmrc = require('../../../lib/workers/branch/npmrc');

describe('workers/branch/npmrc', () => {
  describe('validateNpmrc(npmrc)', () => {
    it('returns errors for invalid npmrc config options', () => {
      expect(npmrc.validateNpmrc('foo bar=bar').length).toBe(1);
    });
    it('returns empty for valid npmrc config options', () => {
      expect(npmrc.validateNpmrc('foo=bar')).toEqual([]);
    });
  });
});
