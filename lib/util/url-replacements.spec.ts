import { logger } from '~test/util.ts';
import type { UrlReplacement } from '../config/types.ts';
import {
  getUrlReplacements,
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
  });
});
