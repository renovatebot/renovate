import nuget from '.';

describe('versioning/nuget/index', () => {
  describe('isVersion and isValid', () => {
    [
      '9.0.3',
      '1.2019.3.22',
      '3.0.0-beta',
      '2.0.2-pre20191018090318',
      '1.0.0+c30d7625',
      '2.3.4-beta+1990ef74',
      '17.04',
      '3.0.0.beta',
      '5.1.2-+',
    ].forEach((version) => {
      it(version, () => {
        // FIXME: explicit assert condition
        expect(nuget.isVersion(version)).toMatchSnapshot();
        expect(nuget.isValid(version)).toMatchSnapshot();
      });
    });
  });
  describe('isStable', () => {
    [
      '9.0.3',
      '1.2019.3.22',
      '3.0.0-beta',
      '2.0.2-pre20191018090318',
      '1.0.0+c30d7625',
      '2.3.4-beta+1990ef74',
    ].forEach((version) => {
      it(version, () => {
        // FIXME: explicit assert condition
        expect(nuget.isStable(version)).toMatchSnapshot();
      });
    });
  });
  describe('isEqual', () => {
    it('should ignore leading zeros', () => {
      expect(nuget.equals('17.4', '17.04')).toBeTrue();
    });
    it('should treat missing trailing version parts as zero', () => {
      expect(nuget.equals('1.4', '1.4.0')).toBeTrue();
      expect(nuget.equals('1.0.110', '1.0.110.0')).toBeTrue();
    });
    it('should ignore hash suffixes', () => {
      expect(nuget.equals('1.0.0', '1.0.0+c30d7625')).toBeTrue();
    });
  });
  describe('isGreaterThan', () => {
    it('should compare using release number then suffix', () => {
      expect(nuget.isGreaterThan('2.4.2', '2.4.1')).toBeTrue();
      expect(nuget.isGreaterThan('2.4-beta', '2.4-alpha')).toBeTrue();
      expect(nuget.isGreaterThan('1.9', '2')).toBeFalse();
      expect(nuget.isGreaterThan('1.9', '1.9.1')).toBeFalse();
    });
    it('should prioritize non-prerelease over prerelease', () => {
      expect(nuget.isGreaterThan('2.4.0', '2.4.0-beta')).toBeTrue();
      expect(nuget.isGreaterThan('2.4.0-alpha', '2.4.0')).toBeFalse();
    });
  });
});
