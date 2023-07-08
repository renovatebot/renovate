import { CurrentAgeMatcher } from './current-age';

describe('util/package-rules/current-age', () => {
  const matcher = new CurrentAgeMatcher();

  describe('match', () => {
    it('return false if release is older', () => {
      const result = matcher.matches(
        {
          releaseTimestamp: '2020-01-01',
        },
        {
          matchCurrentAge: '1.2.3',
        }
      );
      expect(result).toBeFalse();
    });

    it('return false if release is younger', () => {
      const result = matcher.matches(
        {
          releaseTimestamp: '2020-01-01',
        },
        {
          matchCurrentAge: '1.2.3',
        }
      );
      expect(result).toBeFalse();
    });

    it('return false if release invalid', () => {
      const result = matcher.matches(
        {
          releaseTimestamp: '2020-01-01',
        },
        {
          matchCurrentAge: 'bbbbbb',
        }
      );
      expect(result).toBeFalse();
    });

    it('return false for regex version non match', () => {
      const result = matcher.matches(
        {
          releaseTimestamp: '2020-01-01',
        },
        {
          matchCurrentAge: '/^v?[~ -]?0/',
        }
      );
      expect(result).toBeFalse();
    });

    it('return true for regex version match', () => {
      const result = matcher.matches(
        {
          releaseTimestamp: '2020-01-01',
        },
        {
          matchCurrentAge: '/^v?[~ -]?0/',
        }
      );
      expect(result).toBeTrue();
    });

    it('return false for regex value match', () => {
      const result = matcher.matches(
        {
          releaseTimestamp: '2020-01-01',
        },
        {
          matchCurrentAge: '/^v?[~ -]?0/',
        }
      );
      expect(result).toBeFalse();
    });
  });
});
