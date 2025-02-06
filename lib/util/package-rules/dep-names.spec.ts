import { DepNameMatcher } from './dep-names';

describe('util/package-rules/dep-names', () => {
  const depNameMatcher = new DepNameMatcher();

  describe('match', () => {
    it('should return false if packageFile is not defined', () => {
      const result = depNameMatcher.matches(
        {
          depName: undefined,
        },
        {
          matchDepNames: ['@opentelemetry/http'],
        },
      );
      expect(result).toBeFalse();
    });

    it('should return false if depName is excluded prefix', () => {
      expect(
        depNameMatcher.matches(
          {
            depName: '@opentelemetry/http',
          },
          {
            matchDepNames: ['!/^@opentelemetry/'],
          },
        ),
      ).toBeFalse();
      expect(
        depNameMatcher.matches(
          {
            depName: '@opentelemetry/http',
          },
          {
            matchDepNames: ['!@opentelemetry{/,}**'],
          },
        ),
      ).toBeFalse();
    });

    it('should return true if depName is included prefix', () => {
      expect(
        depNameMatcher.matches(
          {
            depName: '@opentelemetry/http',
          },
          {
            matchDepNames: ['/^@opentelemetry/'],
          },
        ),
      ).toBeTrue();
      expect(
        depNameMatcher.matches(
          {
            depName: '@opentelemetry/http',
          },
          {
            matchDepNames: ['@opentelemetry{/,}**'],
          },
        ),
      ).toBeTrue();
    });

    it('should return false if for wrong prefix', () => {
      expect(
        depNameMatcher.matches(
          {
            depName: '@opentelemetry/http',
          },
          {
            matchDepNames: ['@opentelemetry**'],
          },
        ),
      ).toBeFalse();
    });
  });
});
