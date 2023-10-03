import pep440 from '../../modules/versioning/pep440';
import { CurrentVersionMatcher } from './current-version';

describe('util/package-rules/current-version', () => {
  const matcher = new CurrentVersionMatcher();

  describe('match', () => {
    it('return false on version exception', () => {
      const spy = jest.spyOn(pep440, 'matches').mockImplementationOnce(() => {
        throw new Error();
      });
      const result = matcher.matches(
        {
          versioning: 'pep440',
          currentValue: '===>1.2.3',
        },
        {
          matchCurrentVersion: '1.2.3',
        }
      );
      expect(result).toBeFalse();
      expect(spy.mock.calls).toHaveLength(1);
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
        }
      );
      expect(result).toBeFalse();
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
        }
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
        }
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
        }
      );
      expect(result).toBeFalse();
    });
  });
});
