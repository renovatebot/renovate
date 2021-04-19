import { getName } from '../../../test/util';
import { api as hexScheme } from '.';

describe(getName(__filename), () => {
  describe('hexScheme.matches()', () => {
    it('handles tilde greater than', () => {
      expect(hexScheme.matches('4.2.0', '~> 4.0')).toBe(true);
      expect(hexScheme.matches('2.1.0', '~> 2.0.0')).toBe(false);
      expect(hexScheme.matches('2.0.0', '>= 2.0.0 and < 2.1.0')).toBe(true);
      expect(hexScheme.matches('2.1.0', '== 2.0.0 or < 2.1.0')).toBe(false);
      expect(hexScheme.matches('1.9.4', '== 1.9.4')).toBe(true);
      expect(hexScheme.matches('1.9.5', '== 1.9.4')).toBe(false);
    });
  });
  it('handles tilde greater than', () => {
    expect(
      hexScheme.getSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0'],
        '~> 4.0'
      )
    ).toBe('4.2.0');
    expect(
      hexScheme.getSatisfyingVersion(
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
    it('handles ==', () => {
      expect(hexScheme.isValid('== 1.0.0')).toBeTruthy();
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
    it('handles exact pin', () => {
      expect(
        hexScheme.getNewValue({
          currentValue: '== 1.2.3',
          rangeStrategy: 'pin',
          currentVersion: '1.2.3',
          newVersion: '2.0.7',
        })
      ).toEqual('== 2.0.7');
    });
    it('handles exact bump', () => {
      expect(
        hexScheme.getNewValue({
          currentValue: '== 3.6.1',
          rangeStrategy: 'bump',
          currentVersion: '3.6.1',
          newVersion: '3.6.2',
        })
      ).toEqual('== 3.6.2');
    });
    it('handles exact replace', () => {
      expect(
        hexScheme.getNewValue({
          currentValue: '== 3.6.1',
          rangeStrategy: 'replace',
          currentVersion: '3.6.1',
          newVersion: '3.6.2',
        })
      ).toEqual('== 3.6.2');
    });
    it('handles tilde greater than', () => {
      expect(
        hexScheme.getNewValue({
          currentValue: '~> 1.2',
          rangeStrategy: 'replace',
          currentVersion: '1.2.3',
          newVersion: '2.0.7',
        })
      ).toEqual('~> 2.0');
      expect(
        hexScheme.getNewValue({
          currentValue: '~> 1.2',
          rangeStrategy: 'pin',
          currentVersion: '1.2.3',
          newVersion: '2.0.7',
        })
      ).toEqual('== 2.0.7');
      expect(
        hexScheme.getNewValue({
          currentValue: '~> 1.2',
          rangeStrategy: 'bump',
          currentVersion: '1.2.3',
          newVersion: '2.0.7',
        })
      ).toEqual('~> 2.0');
      expect(
        hexScheme.getNewValue({
          currentValue: '~> 1.2',
          rangeStrategy: 'bump',
          currentVersion: '1.2.3',
          newVersion: '1.3.1',
        })
      ).toEqual('~> 1.3');
      expect(
        hexScheme.getNewValue({
          currentValue: '~> 1.2.0',
          rangeStrategy: 'replace',
          currentVersion: '1.2.3',
          newVersion: '2.0.7',
        })
      ).toEqual('~> 2.0.0');
      expect(
        hexScheme.getNewValue({
          currentValue: '~> 1.2.0',
          rangeStrategy: 'pin',
          currentVersion: '1.2.3',
          newVersion: '2.0.7',
        })
      ).toEqual('== 2.0.7');
      expect(
        hexScheme.getNewValue({
          currentValue: '~> 1.2.0',
          rangeStrategy: 'bump',
          currentVersion: '1.2.3',
          newVersion: '2.0.7',
        })
      ).toEqual('~> 2.0.7');
    });
  });
  it('handles and', () => {
    expect(
      hexScheme.getNewValue({
        currentValue: '>= 1.0.0 and <= 2.0.0',
        rangeStrategy: 'widen',
        currentVersion: '1.2.3',
        newVersion: '2.0.7',
      })
    ).toEqual('>= 1.0.0 and <= 2.0.7');
    expect(
      hexScheme.getNewValue({
        currentValue: '>= 1.0.0 and <= 2.0.0',
        rangeStrategy: 'replace',
        currentVersion: '1.2.3',
        newVersion: '2.0.7',
      })
    ).toEqual('<= 2.0.7');
    expect(
      hexScheme.getNewValue({
        currentValue: '>= 1.0.0 and <= 2.0.0',
        rangeStrategy: 'pin',
        currentVersion: '1.2.3',
        newVersion: '2.0.7',
      })
    ).toEqual('== 2.0.7');
  });
  it('handles or', () => {
    expect(
      hexScheme.getNewValue({
        currentValue: '>= 1.0.0 or <= 2.0.0',
        rangeStrategy: 'widen',
        currentVersion: '1.2.3',
        newVersion: '2.0.7',
      })
    ).toEqual('>= 1.0.0 or <= 2.0.0');
    expect(
      hexScheme.getNewValue({
        currentValue: '>= 1.0.0 or <= 2.0.0',
        rangeStrategy: 'replace',
        currentVersion: '1.2.3',
        newVersion: '2.0.7',
      })
    ).toEqual('<= 2.0.7');
    expect(
      hexScheme.getNewValue({
        currentValue: '>= 1.0.0 or <= 2.0.0',
        rangeStrategy: 'pin',
        currentVersion: '1.2.3',
        newVersion: '2.0.7',
      })
    ).toEqual('== 2.0.7');
  });
  it('handles short range replace', () => {
    expect(
      hexScheme.getNewValue({
        currentValue: '~> 0.4',
        rangeStrategy: 'replace',
        currentVersion: '0.4.2',
        newVersion: '0.6.0',
      })
    ).toEqual('~> 0.6');
  });
});
