import pep440 from '../../modules/versioning/pep440';
import { CurrentVersionMatcher } from './current-version';

describe('util/package-rules/current-version', () => {
  const matcher = new CurrentVersionMatcher();

  describe('match', () => {
    it('returns true for null versioning', () => {
      const result = matcher.matches(
        {
          // @ts-expect-error: for testing
          versioning: null,
          currentValue: '1.2.3',
        },
        {
          matchCurrentVersion: '1.2.3',
        },
      );
      expect(result).toBeTrue();
    });

    it('return false on version exception', () => {
      const spy = jest.spyOn(pep440, 'isValid').mockImplementationOnce(() => {
        throw new Error();
      });
      const result = matcher.matches(
        {
          versioning: 'pep440',
          currentValue: '===>1.2.3',
        },
        {
          matchCurrentVersion: '1.2.3',
        },
      );
      expect(result).toBeFalse();
      expect(spy.mock.calls).toHaveLength(1);
    });

    it('return true for a valid match', () => {
      const result = matcher.matches(
        {
          versioning: 'pep440',
          currentValue: '1.2.3',
        },
        {
          matchCurrentVersion: '<1.2.3.5',
        },
      );
      expect(result).toBeTrue();
    });

    it('return false if no version could be found', () => {
      const result = matcher.matches(
        {
          versioning: 'pep440',
          currentValue: 'aaaaaa',
          lockedVersion: 'bbbbbb',
        },
        {
          matchCurrentVersion: 'bbbbbb',
        },
      );
      expect(result).toBeFalse();
    });

    it('case insensitive match', () => {
      const result = matcher.matches(
        {
          versioning: 'pep440',
          currentValue: 'bbbbbb',
        },
        {
          matchCurrentVersion: '/BBB.*/i',
        },
      );
      expect(result).toBeTrue();
    });

    it('return false for regex version non match', () => {
      const result = matcher.matches(
        {
          versioning: 'ruby',
          currentValue: '"~> 1.1.0"',
          lockedVersion: '1.1.4',
        },
        {
          matchCurrentVersion: '/^v?[~ -]?0/',
        },
      );
      expect(result).toBeFalse();
    });

    it('return true for regex version match', () => {
      const result = matcher.matches(
        {
          versioning: 'ruby',
          currentValue: '"~> 0.1.0"',
          lockedVersion: '0.1.0',
        },
        {
          matchCurrentVersion: '/^v?[~ -]?0/',
        },
      );
      expect(result).toBeTrue();
    });

    it('return false for regex value match', () => {
      const result = matcher.matches(
        {
          versioning: 'ruby',
          currentValue: '"~> 0.1.0"',
        },
        {
          matchCurrentVersion: '/^v?[~ -]?0/',
        },
      );
      expect(result).toBeFalse();
    });

    it('return true for same-major verisioning if version lies in expected range', () => {
      const result = matcher.matches(
        {
          versioning: 'same-major',
          currentValue: '6.0.300',
        },
        {
          matchCurrentVersion: '6.0.400',
        },
      );
      expect(result).toBeTrue();
    });

    it('return false for same-major verisioning if version lies outside of expected range', () => {
      const result = matcher.matches(
        {
          versioning: 'same-major',
          currentValue: '6.0.300',
        },
        {
          matchCurrentVersion: '6.0.100',
        },
      );
      expect(result).toBeFalse();
    });
  });
});
