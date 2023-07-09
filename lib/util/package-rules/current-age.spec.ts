import { CurrentAgeMatcher } from './current-age';

describe('util/package-rules/current-age', () => {
  const matcher = new CurrentAgeMatcher();

  describe('match', () => {
    it('returns false if release is older', () => {
      const result = matcher.matches(
        {
          releaseTimestamp: '2020-01-01',
        },
        {
          matchCurrentAge: '< 1 year', // younger than 1 year
        }
      );
      expect(result).toBeFalse();
    });

    it('returns false if release is younger', () => {
      const result = matcher.matches(
        {
          releaseTimestamp: '2020-01-01',
        },
        {
          matchCurrentAge: '> 10 years', // older than 10 yrs
        }
      );
      expect(result).toBeFalse();
    });

    it('returns null if release invalid', () => {
      const result = matcher.matches(
        {
          releaseTimestamp: null,
        },
        {
          matchCurrentAge: '> 2 days', // older than 2 days
        }
      );
      expect(result).toBeNull();
    });

    it('returns true if age matches', () => {
      const result = matcher.matches(
        {
          releaseTimestamp: '2020-01-01',
        },
        {
          matchCurrentAge: '> 3 years', // older than 3 years
        }
      );
      expect(result).toBeTrue();
    });
  });
});
