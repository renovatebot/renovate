import nuget from '.';

describe('nuget.', () => {
  it('isValid', () => {
    expect(nuget.isValid('9.0.3')).toBeTrue();
    expect(nuget.isValid('9.0.3')).toBeTrue();
    expect(nuget.isValid('1.2019.3.22')).toBeTrue();
    expect(nuget.isValid('3.0.0-beta')).toBeTrue();
    expect(nuget.isValid('2.0.2-pre20191018090318')).toBeTrue();
    expect(nuget.isValid('1.0.0+c30d7625')).toBeTrue();
    expect(nuget.isValid('2.3.4-beta+1990ef74')).toBeTrue();
    expect(nuget.isValid('17.04')).toBeTrue();
    expect(nuget.isValid('3.0.0.beta')).toBeFalse();
    expect(nuget.isValid('5.1.2-+')).toBeFalse();
    expect(nuget.isValid('[9.0.3]')).toBeTrue();
    expect(nuget.isValid('(9.0.3)')).toBeFalse();
    expect(nuget.isValid('9.0.3-*')).toBeTrue();
    expect(nuget.isValid('9.0.*')).toBeTrue();
    expect(nuget.isValid('9.*')).toBeTrue();
    expect(nuget.isValid('*')).toBeTrue();
    expect(nuget.isValid('9.*.3')).toBeFalse();
    expect(nuget.isValid('1-a')).toBeTrue();
    expect(nuget.isValid('1-b')).toBeTrue();
    expect(nuget.isValid('[1-b,1-a]')).toBeFalse();
    expect(nuget.isValid('[1-a,1-b]')).toBeTrue();
  });
  it('isStable', () => {
    expect(nuget.isStable('9.0.3')).toBeTrue();
    expect(nuget.isStable('[9.0.3]')).toBeTrue();
    expect(nuget.isStable('1.2019.3.22')).toBeTrue();
    expect(nuget.isStable('3.0.0-beta')).toBeFalse();
    expect(nuget.isStable('2.0.2-pre20191018090318')).toBeFalse();
    expect(nuget.isStable('1.0.0+c30d7625')).toBeTrue();
    expect(nuget.isStable('2.3.4-beta+1990ef74')).toBeFalse();
  });
  it('isSingleVersion', () => {
    expect(nuget.isSingleVersion('9.0.3')).toBeFalse();
    expect(nuget.isSingleVersion('[9.0.3]')).toBeTrue();
    expect(nuget.isSingleVersion('[9.0.3,]')).toBeNull();
    expect(nuget.isSingleVersion('[,9.0.3]')).toBeNull();
  });
  describe('isEqual', () => {
    it('handles invalid versions', () => {
      expect(nuget.equals('17.4', '')).toBeFalse();
      expect(nuget.equals('', '17.4')).toBeFalse();
      expect(nuget.equals('', '')).toBeFalse();
    });
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
  it('isLessThanRange', () => {
    expect(nuget.isLessThanRange('1.2.2', '')).toBeFalse();
    expect(nuget.isLessThanRange('1.2.2', '1.2.3')).toBeTrue();
    expect(nuget.isLessThanRange('1.2.3', '1.2.3')).toBeFalse();
    expect(nuget.isLessThanRange('1.2.3', '1.2.2')).toBeFalse();

    expect(nuget.isLessThanRange('1.0.0', '1.2.*')).toBeTrue();
    expect(nuget.isLessThanRange('1.0.0', '1.*')).toBeFalse();
    expect(nuget.isLessThanRange('1.0.0-alpha', '1.*')).toBeTrue();
    expect(nuget.isLessThanRange('1.0-alpha', '1.*')).toBeTrue();
    expect(nuget.isLessThanRange('1-alpha', '1.*')).toBeTrue();
    expect(nuget.isLessThanRange('0.999', '1.*')).toBeTrue();
    expect(nuget.isLessThanRange('0', '*')).toBeFalse();

    expect(nuget.isLessThanRange('0', '(,2)')).toBeFalse();
    expect(nuget.isLessThanRange('0.9', '(1,2)')).toBeTrue();
    expect(nuget.isLessThanRange('1', '(1,2)')).toBeTrue();
    expect(nuget.isLessThanRange('1', '(1-alpha,2)')).toBeFalse();
    expect(nuget.isLessThanRange('1.2.3', '(1,2)')).toBeFalse();
    expect(nuget.isLessThanRange('0.9', '[1,2)')).toBeTrue();
    expect(nuget.isLessThanRange('1', '[1,2)')).toBeFalse();
    expect(nuget.isLessThanRange('1', '[1-alpha,2)')).toBeFalse();
    expect(nuget.isLessThanRange('1-alpha', '[1,2)')).toBeTrue();

    expect(nuget.isLessThanRange('1', '1-*')).toBeFalse();
    expect(nuget.isLessThanRange('1-0', '1-*')).toBeFalse();
    expect(nuget.isLessThanRange('1-a', '1-*')).toBeFalse();
    expect(nuget.isLessThanRange('1-z', '1-*')).toBeFalse();
    expect(nuget.isLessThanRange('0', '1-*')).toBeTrue();
  });

  it('matches', () => {
    expect(nuget.matches('1.2.0', '')).toBeFalse();
    expect(nuget.matches('1.2.0', '1.2.3')).toBeFalse();
    expect(nuget.matches('1.2.3', '1.2.0')).toBeFalse();
    expect(nuget.matches('1.2.3', '1.2.3')).toBeTrue();

    expect(nuget.matches('1.0.0', '1.2.*')).toBeFalse();
    expect(nuget.matches('1.0', '1.2.*')).toBeFalse();
    expect(nuget.matches('1', '1.2.*')).toBeFalse();
    expect(nuget.matches('1.1.0', '1.2.*')).toBeFalse();
    expect(nuget.matches('1.1', '1.2.*')).toBeFalse();
    expect(nuget.matches('1.2.0', '1.2.*')).toBeTrue();
    expect(nuget.matches('1.2.1', '1.2.*')).toBeTrue();
    expect(nuget.matches('1.2.9', '1.2.*')).toBeTrue();
    expect(nuget.matches('1.2', '1.2.*')).toBeTrue();
    expect(nuget.matches('1.3', '1.2.*')).toBeFalse();
    expect(nuget.matches('0', '1.*')).toBeFalse();
    expect(nuget.matches('0.1', '1.*')).toBeFalse();
    expect(nuget.matches('1', '1.*')).toBeTrue();
    expect(nuget.matches('1.9', '1.*')).toBeTrue();
    expect(nuget.matches('1.0.9', '1.*')).toBeTrue();
    expect(nuget.matches('0', '*')).toBeTrue();
    expect(nuget.matches('1', '*')).toBeTrue();
    expect(nuget.matches('1.1', '*')).toBeTrue();
    expect(nuget.matches('0', '1-*')).toBeFalse();
    expect(nuget.matches('0', '1.0-*')).toBeFalse();
    expect(nuget.matches('0', '1.0.0-*')).toBeFalse();
    expect(nuget.matches('1', '1-*')).toBeFalse();
    expect(nuget.matches('1', '1.0-*')).toBeFalse();
    expect(nuget.matches('1', '1.0.0-*')).toBeFalse();
    expect(nuget.matches('1-alpha', '1-*')).toBeTrue();
    expect(nuget.matches('1-alpha', '1.0-*')).toBeTrue();
    expect(nuget.matches('1-alpha', '1.0.0-*')).toBeTrue();
    expect(nuget.matches('1-alpha', '1-*')).toBeTrue();
    expect(nuget.matches('1.0-alpha', '1-*')).toBeTrue();
    expect(nuget.matches('1.0.0-alpha', '1-*')).toBeTrue();

    expect(nuget.matches('1', '[,2]')).toBeTrue();
    expect(nuget.matches('1.0', '[,2]')).toBeTrue();
    expect(nuget.matches('1.0.0', '[,2]')).toBeTrue();
    expect(nuget.matches('1.0.0-alpha', '[,2]')).toBeTrue();
    expect(nuget.matches('1', '[1,2]')).toBeTrue();
    expect(nuget.matches('1.0', '[1,2]')).toBeTrue();
    expect(nuget.matches('1.0.0', '[1,2]')).toBeTrue();
    expect(nuget.matches('1.0.0-alpha', '[1,2]')).toBeFalse();
    expect(nuget.matches('1.2.3', '[1,2]')).toBeTrue();
    expect(nuget.matches('2', '[1,2]')).toBeTrue();
    expect(nuget.matches('2.0', '[1,2]')).toBeTrue();
    expect(nuget.matches('2.0.0', '[1,2]')).toBeTrue();
    expect(nuget.matches('2.0.0-alpha', '[1,2]')).toBeTrue();
    expect(nuget.matches('2', '[1,]')).toBeTrue();
    expect(nuget.matches('2.0', '[1,]')).toBeTrue();
    expect(nuget.matches('2.0.0', '[1,]')).toBeTrue();
    expect(nuget.matches('2.0.0-alpha', '[1,]')).toBeTrue();

    expect(nuget.matches('1', '(,2)')).toBeTrue();
    expect(nuget.matches('1.0', '(,2)')).toBeTrue();
    expect(nuget.matches('1.0.0', '(,2)')).toBeTrue();
    expect(nuget.matches('1-alpha', '(,2)')).toBeTrue();
    expect(nuget.matches('1.0-alpha', '(,2)')).toBeTrue();
    expect(nuget.matches('1.0.0-alpha', '(,2)')).toBeTrue();
    expect(nuget.matches('1', '(1,2)')).toBeFalse();
    expect(nuget.matches('1.0', '(1,2)')).toBeFalse();
    expect(nuget.matches('1.0.0', '(1,2)')).toBeFalse();
    expect(nuget.matches('1-alpha', '(1,2)')).toBeFalse();
    expect(nuget.matches('1.0-alpha', '(1,2)')).toBeFalse();
    expect(nuget.matches('1.0.0-alpha', '(1,2)')).toBeFalse();
    expect(nuget.matches('1.2.3', '(1,2)')).toBeTrue();
    expect(nuget.matches('1.2.3-alpha', '(1,2)')).toBeTrue();
    expect(nuget.matches('2', '(1,2)')).toBeFalse();
    expect(nuget.matches('2.0', '(1,2)')).toBeFalse();
    expect(nuget.matches('2.0.0', '(1,2)')).toBeFalse();
    expect(nuget.matches('2-alpha', '(1,2)')).toBeTrue();
    expect(nuget.matches('2.0-alpha', '(1,2)')).toBeTrue();
    expect(nuget.matches('2.0.0-alpha', '(1,2)')).toBeTrue();
    expect(nuget.matches('2', '(1,)')).toBeTrue();
    expect(nuget.matches('1-b', '(1-a,1-c)')).toBeTrue();
    expect(nuget.matches('1-b', '(1-c,1-a)')).toBeFalse();
  });
});
