import { CurrentValueMatcher } from './current-value';

describe('util/package-rules/current-value', () => {
  const matcher = new CurrentValueMatcher();

  describe('match', () => {
    it('return true for exact match', () => {
      const result = matcher.matches(
        {
          currentValue: '1.1.0',
        },
        {
          matchCurrentValue: '1.1.0',
        },
      );
      expect(result).toBeTrue();
    });

    it('return true for glob match', () => {
      const result = matcher.matches(
        {
          currentValue: '1.2.3',
        },
        {
          matchCurrentValue: '1.2.*',
        },
      );
      expect(result).toBeTrue();
    });

    it('return false for glob non match', () => {
      const result = matcher.matches(
        {
          currentValue: '1.2.3',
        },
        {
          matchCurrentValue: '1.3.*',
        },
      );
      expect(result).toBeFalse();
    });

    it('return false for regex version non match', () => {
      const result = matcher.matches(
        {
          currentValue: '"~> 1.1.0"',
        },
        {
          matchCurrentValue: '/^v/',
        },
      );
      expect(result).toBeFalse();
    });

    it('case insensitive match', () => {
      const result = matcher.matches(
        {
          currentValue: '"V1.1.0"',
        },
        {
          matchCurrentValue: '/^"v/i',
        },
      );
      expect(result).toBeTrue();
    });

    it('return true for regex version match', () => {
      const result = matcher.matches(
        {
          currentValue: '"~> 0.1.0"',
        },
        {
          matchCurrentValue: '/^"/',
        },
      );
      expect(result).toBeTrue();
    });

    it('return false for now value', () => {
      const result = matcher.matches(
        {},
        {
          matchCurrentValue: '/^v?[~ -]?0/',
        },
      );
      expect(result).toBeFalse();
    });
  });
});
