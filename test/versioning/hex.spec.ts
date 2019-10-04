import { api as hexScheme } from '../../lib/versioning/hex';

describe('lib/versioning/hex', () => {
  describe('hexScheme.matches()', () => {
    it('handles tilde greater than', () => {
      expect(hexScheme.matches('4.2.0', '~> 4.0')).toBe(true);
      expect(hexScheme.matches('2.1.0', '~> 2.0.0')).toBe(false);
      expect(hexScheme.matches('2.0.0', '>= 2.0.0 and < 2.1.0')).toBe(true);
      expect(hexScheme.matches('2.1.0', '== 2.0.0 or < 2.1.0')).toBe(false);
    });
  });
  it('handles tilde greater than', () => {
    expect(
      hexScheme.maxSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0'],
        '~> 4.0'
      )
    ).toBe('4.2.0');
    expect(
      hexScheme.maxSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0'],
        '~> 4.0.0'
      )
    ).toBe('4.0.0');
  });
  describe('hexScheme.isValid()', () => {
    it('handles and', () => {
      expect(hexScheme.isValid('>= 1.0.0 and <= 2.0.0')).toBeTruthy();
    });
    it('handles or', () => {
      expect(hexScheme.isValid('>= 1.0.0 or <= 2.0.0')).toBeTruthy();
    });
    it('handles !=', () => {
      expect(hexScheme.isValid('!= 1.0.0')).toBeTruthy();
    });
  });
  describe('hexScheme.isLessThanRange()', () => {
    it('handles and', () => {
      expect(hexScheme.isLessThanRange('0.1.0', '>= 1.0.0 and <= 2.0.0')).toBe(
        true
      );
      expect(hexScheme.isLessThanRange('1.9.0', '>= 1.0.0 and <= 2.0.0')).toBe(
        false
      );
    });
    it('handles or', () => {
      expect(hexScheme.isLessThanRange('0.9.0', '>= 1.0.0 or >= 2.0.0')).toBe(
        true
      );
      expect(hexScheme.isLessThanRange('1.9.0', '>= 1.0.0 or >= 2.0.0')).toBe(
        false
      );
    });
  });
  describe('hexScheme.minSatisfyingVersion()', () => {
    it('handles tilde greater than', () => {
      expect(
        hexScheme.minSatisfyingVersion(
          ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
          '~> 4.0'
        )
      ).toBe('4.2.0');
      expect(
        hexScheme.minSatisfyingVersion(
          ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
          '~> 4.0.0'
        )
      ).toBeNull();
    });
  });
  describe('hexScheme.getNewValue()', () => {
    it('handles tilde greater than', () => {
      expect(
        hexScheme.getNewValue('~> 1.2', 'replace', '1.2.3', '2.0.7')
      ).toEqual('~> 2.0');
      expect(hexScheme.getNewValue('~> 1.2', 'pin', '1.2.3', '2.0.7')).toEqual(
        '2.0.7'
      );
      expect(hexScheme.getNewValue('~> 1.2', 'bump', '1.2.3', '2.0.7')).toEqual(
        '~> 2'
      );
      expect(
        hexScheme.getNewValue('~> 1.2.0', 'replace', '1.2.3', '2.0.7')
      ).toEqual('~> 2.0.0');
      expect(
        hexScheme.getNewValue('~> 1.2.0', 'pin', '1.2.3', '2.0.7')
      ).toEqual('2.0.7');
      expect(
        hexScheme.getNewValue('~> 1.2.0', 'bump', '1.2.3', '2.0.7')
      ).toEqual('~> 2.0.7');
    });
  });
  it('handles and', () => {
    expect(
      hexScheme.getNewValue('>= 1.0.0 and <= 2.0.0', 'widen', '1.2.3', '2.0.7')
    ).toEqual('>= 1.0.0 and <= 2.0.7');
    expect(
      hexScheme.getNewValue(
        '>= 1.0.0 and <= 2.0.0',
        'replace',
        '1.2.3',
        '2.0.7'
      )
    ).toEqual('<= 2.0.7');
    expect(
      hexScheme.getNewValue('>= 1.0.0 and <= 2.0.0', 'pin', '1.2.3', '2.0.7')
    ).toEqual('2.0.7');
  });
  it('handles or', () => {
    expect(
      hexScheme.getNewValue('>= 1.0.0 or <= 2.0.0', 'widen', '1.2.3', '2.0.7')
    ).toEqual('>= 1.0.0 or <= 2.0.7');
    expect(
      hexScheme.getNewValue('>= 1.0.0 or <= 2.0.0', 'replace', '1.2.3', '2.0.7')
    ).toEqual('<= 2.0.7');
    expect(
      hexScheme.getNewValue('>= 1.0.0 or <= 2.0.0', 'pin', '1.2.3', '2.0.7')
    ).toEqual('2.0.7');
  });
});
