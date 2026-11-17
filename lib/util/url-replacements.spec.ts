import { logger } from '~test/util.ts';
import type { UrlReplacement } from '../config/types.ts';
import {
  getUrlReplacements,
  isChainedUrlReplacement,
  isShadowedUrlReplacement,
  isValidUrlReplacement,
} from './url-replacements.ts';

describe('util/url-replacements', () => {
  describe('isValidUrlReplacement', () => {
    it.each`
      matchUrlPrefix                 | replaceUrlPrefix                 | expected
      ${'https://repo.example.com/'} | ${'https://mirror.example.com/'} | ${true}
      ${'https://repo.example.com'}  | ${'https://mirror.example.com/'} | ${false}
      ${'https://repo.example.com/'} | ${'https://Mirror.example.com/'} | ${false}
    `(
      'is $expected for $matchUrlPrefix -> $replaceUrlPrefix',
      ({ matchUrlPrefix, replaceUrlPrefix, expected }) => {
        expect(
          isValidUrlReplacement({ matchUrlPrefix, replaceUrlPrefix }),
        ).toBe(expected);
      },
    );
  });

  describe('isChainedUrlReplacement', () => {
    const rule: UrlReplacement = {
      matchUrlPrefix: 'https://repo.example.com/',
      replaceUrlPrefix: 'https://mirror.example.com/repo/',
    };

    it.each`
      matchUrlPrefix                          | expected
      ${'https://mirror.example.com/'}        | ${true}
      ${'https://mirror.example.com/repo/'}   | ${true}
      ${'https://mirror.example.com/repo/a/'} | ${true}
      ${'https://mirror.example.com/other/'}  | ${false}
      ${'https://repo.example.com/'}          | ${false}
    `(
      'is $expected for another rule matching $matchUrlPrefix',
      ({ matchUrlPrefix, expected }) => {
        const other: UrlReplacement = {
          matchUrlPrefix,
          replaceUrlPrefix: 'https://other.example.com/',
        };

        expect(isChainedUrlReplacement(rule, [rule, other])).toBe(expected);
      },
    );

    it('ignores the rule itself', () => {
      const self: UrlReplacement = {
        matchUrlPrefix: 'https://repo.example.com/',
        replaceUrlPrefix: 'https://repo.example.com/mirror/',
      };

      expect(isChainedUrlReplacement(self, [self])).toBeFalse();
    });
  });

  describe('isShadowedUrlReplacement', () => {
    it.each`
      earlierMatchUrlPrefix                  | expected
      ${'https://repo.example.com/'}         | ${true}
      ${'https://repo.example.com/maven/'}   | ${true}
      ${'https://repo.example.com/maven/a/'} | ${false}
      ${'https://other.example.com/'}        | ${false}
    `(
      'is $expected for an earlier rule matching $earlierMatchUrlPrefix',
      ({ earlierMatchUrlPrefix, expected }) => {
        const rule: UrlReplacement = {
          matchUrlPrefix: 'https://repo.example.com/maven/',
          replaceUrlPrefix: 'https://mirror.example.com/',
        };
        const earlier: UrlReplacement = {
          matchUrlPrefix: earlierMatchUrlPrefix,
          replaceUrlPrefix: 'https://other-mirror.example.com/',
        };

        expect(isShadowedUrlReplacement(rule, [earlier])).toBe(expected);
      },
    );

    it('is false without earlier rules', () => {
      const rule: UrlReplacement = {
        matchUrlPrefix: 'https://repo.example.com/',
        replaceUrlPrefix: 'https://mirror.example.com/',
      };

      expect(isShadowedUrlReplacement(rule, [])).toBeFalse();
    });
  });

  describe('getUrlReplacements', () => {
    it('returns an empty list without rules', () => {
      expect(getUrlReplacements(undefined)).toBeEmptyArray();
    });

    it.each`
      rule
      ${null}
      ${'https://repo.example.com/'}
    `('drops the entry $rule with a warning', ({ rule }) => {
      expect(getUrlReplacements([rule])).toBeEmptyArray();
      expect(logger.logger.once.warn).toHaveBeenCalledExactlyOnceWith(
        { rule },
        'urlReplacements: ignoring an invalid rule',
      );
    });

    it('drops invalid rules with a warning', () => {
      const valid: UrlReplacement = {
        matchUrlPrefix: 'https://repo.example.com/',
        replaceUrlPrefix: 'https://mirror.example.com/repo/',
      };
      const invalid: UrlReplacement = {
        matchUrlPrefix: 'https://dl.example.com',
        replaceUrlPrefix: 'https://mirror.example.com/dl/',
      };

      expect(getUrlReplacements([valid, invalid])).toEqual([valid]);
      expect(logger.logger.once.warn).toHaveBeenCalledExactlyOnceWith(
        { rule: invalid },
        'urlReplacements: ignoring an invalid rule',
      );
    });

    it('drops rules whose replaceUrlPrefix another rule rewrites with a warning', () => {
      const first: UrlReplacement = {
        matchUrlPrefix: 'https://repo.example.com/',
        replaceUrlPrefix: 'https://a.example.com/',
      };
      const second: UrlReplacement = {
        matchUrlPrefix: 'https://a.example.com/',
        replaceUrlPrefix: 'https://mirror.example.com/',
      };

      expect(getUrlReplacements([first, second])).toEqual([second]);
      expect(logger.logger.once.warn).toHaveBeenCalledExactlyOnceWith(
        { rule: first },
        'urlReplacements: ignoring a rule whose replaceUrlPrefix another rule rewrites',
      );
    });

    it('drops rules whose matchUrlPrefix an earlier rule matches with a warning', () => {
      const first: UrlReplacement = {
        matchUrlPrefix: 'https://repo.example.com/',
        replaceUrlPrefix: 'https://mirror.example.com/a/',
      };
      const second: UrlReplacement = {
        matchUrlPrefix: 'https://repo.example.com/maven2/',
        replaceUrlPrefix: 'https://mirror.example.com/b/',
      };

      expect(getUrlReplacements([first, second])).toEqual([first]);
      expect(logger.logger.once.warn).toHaveBeenCalledExactlyOnceWith(
        { rule: second },
        'urlReplacements: ignoring a rule whose matchUrlPrefix an earlier rule matches',
      );
    });

    it('keeps a rule whose matchUrlPrefix only a dropped rule matches', () => {
      const chained: UrlReplacement = {
        matchUrlPrefix: 'https://repo.example.com/',
        replaceUrlPrefix: 'https://a.example.com/',
      };
      const target: UrlReplacement = {
        matchUrlPrefix: 'https://a.example.com/',
        replaceUrlPrefix: 'https://mirror.example.com/a/',
      };
      const later: UrlReplacement = {
        matchUrlPrefix: 'https://repo.example.com/maven2/',
        replaceUrlPrefix: 'https://mirror.example.com/b/',
      };

      expect(getUrlReplacements([chained, target, later])).toEqual([
        target,
        later,
      ]);
    });
  });
});
