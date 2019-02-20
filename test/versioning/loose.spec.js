const loose = require('../../lib/versioning/loose');

describe('loose.', () => {
  describe('isValid(version)', () => {
    it('it must support varied precision, from 1 to 6 sections', () => {
      [
        'v1.4',
        '3.5.0',
        '4.2.21.Final',
        '0.6.5.1',
        '20100527',
        '2.1.0-M3',
        '4.3.20.RELEASE',
        '1.1-groovy-2.4',
        '0.8a',
        '3.1.0.GA',
        '3.0.0-beta.3',
      ].forEach(version => {
        expect(loose.isValid(version)).toBe(version);
      });
      ['foo', '1.2.3.4.5.6.7'].forEach(version => {
        expect(loose.isValid(version)).toBe(null);
      });
    });
  });
  describe('isGreaterThan(version)', () => {
    it('it should compare using release number than suffix', () => {
      expect(loose.isGreaterThan('2.4.0', '2.4')).toBe(true);
      expect(loose.isGreaterThan('2.4.2', '2.4.1')).toBe(true);
      expect(loose.isGreaterThan('2.4.beta', '2.4.alpha')).toBe(true);
      expect(loose.isGreaterThan('1.9', '2')).toBe(false);
      expect(loose.isGreaterThan('1.9', '1.9.1')).toBe(false);
    });
  });
});
