import { NewValueMatcher } from './new-value';

describe('util/package-rules/new-value', () => {
  const matcher = new NewValueMatcher();

  describe('match', () => {
    it('return true for exact match', () => {
      const result = matcher.matches(
        {
          newValue: '1.1.0',
        },
        {
          matchNewValue: '1.1.0',
        },
      );
      expect(result).toBeTrue();
    });

    it('return true for glob match', () => {
      const result = matcher.matches(
        {
          newValue: '1.2.3',
        },
        {
          matchNewValue: '1.2.*',
        },
      );
      expect(result).toBeTrue();
    });

    it('return false for glob non match', () => {
      const result = matcher.matches(
        {
          newValue: '1.2.3',
        },
        {
          matchNewValue: '1.3.*',
        },
      );
      expect(result).toBeFalse();
    });

    it('return false for regex version non match', () => {
      const result = matcher.matches(
        {
          newValue: '"~> 1.1.0"',
        },
        {
          matchNewValue: '/^v/',
        },
      );
      expect(result).toBeFalse();
    });

    it('case insensitive match', () => {
      const result = matcher.matches(
        {
          newValue: '"V1.1.0"',
        },
        {
          matchNewValue: '/^"v/i',
        },
      );
      expect(result).toBeTrue();
    });

    it('return true for regex version match', () => {
      const result = matcher.matches(
        {
          newValue: '"~> 0.1.0"',
        },
        {
          matchNewValue: '/^"/',
        },
      );
      expect(result).toBeTrue();
    });

    it('return false for now value', () => {
      const result = matcher.matches(
        {},
        {
          matchNewValue: '/^v?[~ -]?0/',
        },
      );
      expect(result).toBeFalse();
    });
  });
});
