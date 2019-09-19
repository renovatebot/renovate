import { api } from '../../lib/versioning/hex';

describe('lib/versioning/hex', () => {
  describe('api.matches()', () => {
    it('handles tilde greater than', () => {
      expect(api.matches('4.2.0', '~> 4.0')).toBe(true);
      expect(api.matches('2.1.0', '~> 2.0.0')).toBe(false);
      expect(api.matches('2.0.0', '>= 2.0.0 and < 2.1.0')).toBe(true);
      expect(api.matches('2.1.0', '== 2.0.0 or < 2.1.0')).toBe(false);
    });
  });
  it('handles tilde greater than', () => {
    expect(
      api.maxSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0'],
        '~> 4.0'
      )
    ).toBe('4.2.0');
    expect(
      api.maxSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0'],
        '~> 4.0.0'
      )
    ).toBe('4.0.0');
  });
  describe('api.isValid()', () => {
    it('handles and', () => {
      expect(api.isValid('>= 1.0.0 and <= 2.0.0')).toBeTruthy();
    });
    it('handles or', () => {
      expect(api.isValid('>= 1.0.0 or <= 2.0.0')).toBeTruthy();
    });
    it('handles !=', () => {
      expect(api.isValid('!= 1.0.0')).toBeTruthy();
    });
  });
  describe('api.isLessThanRange()', () => {
    it('handles and', () => {
      expect(api.isLessThanRange('0.1.0', '>= 1.0.0 and <= 2.0.0')).toBe(true);
      expect(api.isLessThanRange('1.9.0', '>= 1.0.0 and <= 2.0.0')).toBe(false);
    });
    it('handles or', () => {
      expect(api.isLessThanRange('0.9.0', '>= 1.0.0 or >= 2.0.0')).toBe(true);
      expect(api.isLessThanRange('1.9.0', '>= 1.0.0 or >= 2.0.0')).toBe(false);
    });
  });
  describe('api.minSatisfyingVersion()', () => {
    it('handles tilde greater than', () => {
      expect(
        api.minSatisfyingVersion(['0.4.0', '0.5.0', '4.2.0', '5.0.0'], '~> 4.0')
      ).toBe('4.2.0');
      expect(
        api.minSatisfyingVersion(
          ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
          '~> 4.0.0'
        )
      ).toBeNull();
    });
  });
  describe('api.getNewValue()', () => {
    it('handles tilde greater than', () => {
      expect(api.getNewValue('~> 1.2', 'replace', '1.2.3', '2.0.7')).toEqual(
        '~> 2.0'
      );
      expect(api.getNewValue('~> 1.2', 'pin', '1.2.3', '2.0.7')).toEqual(
        '2.0.7'
      );
      expect(api.getNewValue('~> 1.2', 'bump', '1.2.3', '2.0.7')).toEqual(
        '~> 2'
      );
      expect(api.getNewValue('~> 1.2.0', 'replace', '1.2.3', '2.0.7')).toEqual(
        '~> 2.0.0'
      );
      expect(api.getNewValue('~> 1.2.0', 'pin', '1.2.3', '2.0.7')).toEqual(
        '2.0.7'
      );
      expect(api.getNewValue('~> 1.2.0', 'bump', '1.2.3', '2.0.7')).toEqual(
        '~> 2.0.7'
      );
    });
  });
  it('handles and', () => {
    expect(
      api.getNewValue('>= 1.0.0 and <= 2.0.0', 'widen', '1.2.3', '2.0.7')
    ).toEqual('>= 1.0.0 and <= 2.0.7');
    expect(
      api.getNewValue('>= 1.0.0 and <= 2.0.0', 'replace', '1.2.3', '2.0.7')
    ).toEqual('<= 2.0.7');
    expect(
      api.getNewValue('>= 1.0.0 and <= 2.0.0', 'pin', '1.2.3', '2.0.7')
    ).toEqual('2.0.7');
  });
  it('handles or', () => {
    expect(
      api.getNewValue('>= 1.0.0 or <= 2.0.0', 'widen', '1.2.3', '2.0.7')
    ).toEqual('>= 1.0.0 or <= 2.0.7');
    expect(
      api.getNewValue('>= 1.0.0 or <= 2.0.0', 'replace', '1.2.3', '2.0.7')
    ).toEqual('<= 2.0.7');
    expect(
      api.getNewValue('>= 1.0.0 or <= 2.0.0', 'pin', '1.2.3', '2.0.7')
    ).toEqual('2.0.7');
  });
});
