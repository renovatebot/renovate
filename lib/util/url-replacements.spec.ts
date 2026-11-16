import { logger } from '~test/util.ts';
import type { UrlReplacement } from '../config/types.ts';
import {
  getUrlReplacements,
  isChainedUrlReplacement,
  isValidUrlReplacement,
} from './url-replacements.ts';

describe('util/url-replacements', () => {
  describe('isValidUrlReplacement', () => {
    it.each`
      matchUrlPrefix                 | replaceUrlPrefix                 | matchHostTypes | expected
      ${'https://repo.example.com/'} | ${'https://mirror.example.com/'} | ${undefined}   | ${true}
      ${'https://repo.example.com/'} | ${'https://mirror.example.com/'} | ${['maven']}   | ${true}
      ${'https://repo.example.com'}  | ${'https://mirror.example.com/'} | ${undefined}   | ${false}
      ${'https://repo.example.com/'} | ${'https://Mirror.example.com/'} | ${undefined}   | ${false}
      ${'https://repo.example.com/'} | ${'https://mirror.example.com/'} | ${'maven'}     | ${false}
      ${'https://repo.example.com/'} | ${'https://mirror.example.com/'} | ${[1]}         | ${false}
    `(
      'is $expected for $matchUrlPrefix -> $replaceUrlPrefix with $matchHostTypes',
      ({ matchUrlPrefix, replaceUrlPrefix, matchHostTypes, expected }) => {
        expect(
          isValidUrlReplacement({
            matchUrlPrefix,
            replaceUrlPrefix,
            matchHostTypes,
          }),
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

  describe('getUrlReplacements', () => {
    it('returns an empty list without rules', () => {
      expect(getUrlReplacements(undefined)).toBeEmptyArray();
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
  });
});
