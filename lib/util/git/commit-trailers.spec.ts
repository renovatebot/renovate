import { codeBlock } from 'common-tags';
import { logger } from '~test/util.ts';
import {
  filterValidCommitTrailers,
  isValidCommitTrailer,
  splitCommitMessage,
} from './commit-trailers.ts';

describe('util/git/commit-trailers', () => {
  describe('isValidCommitTrailer', () => {
    it.each([
      'Signed-off-by: Renovate Bot <bot@renovateapp.com>',
      'Signed-off-by: {{{gitAuthor}}}',
      'Co-authored-by: First Contributor <first@example.com>',
      'Renovate-Update-Type: major',
      'X-Custom: value with spaces',
    ])('accepts %j', (trailer) => {
      expect(isValidCommitTrailer(trailer)).toBeTrue();
    });

    it.each([
      'no colon',
      'Bad key: value',
      'Key:no-space',
      'Key: multi\nline',
      'Signed-off-by: ',
      'Signed-off-by:',
      '',
      42,
      null,
      undefined,
    ])('rejects %j', (trailer) => {
      expect(isValidCommitTrailer(trailer)).toBeFalse();
    });
  });

  describe('filterValidCommitTrailers', () => {
    it('returns valid trailers unchanged', () => {
      const trailers = [
        'Signed-off-by: Renovate Bot <bot@renovateapp.com>',
        'Co-authored-by: First Contributor <first@example.com>',
      ];
      expect(filterValidCommitTrailers(trailers)).toEqual(trailers);
      expect(logger.logger.warn).not.toHaveBeenCalled();
    });

    it('drops invalid trailers and warns', () => {
      expect(
        filterValidCommitTrailers([
          'Signed-off-by: Renovate Bot <bot@renovateapp.com>',
          'Signed-off-by: ',
          'Key: multi\nline',
        ]),
      ).toEqual(['Signed-off-by: Renovate Bot <bot@renovateapp.com>']);
      expect(logger.logger.warn).toHaveBeenCalledExactlyOnceWith(
        { invalid: ['Signed-off-by: ', 'Key: multi\nline'] },
        'Ignoring invalid commit trailers (must be a single-line Key: value)',
      );
    });

    it('returns empty array when all trailers are invalid', () => {
      expect(
        filterValidCommitTrailers(['Signed-off-by: ', 'no colon']),
      ).toEqual([]);
      expect(logger.logger.warn).toHaveBeenCalled();
    });
  });

  describe('splitCommitMessage', () => {
    it('returns the whole message as body when there is no trailer block', () => {
      expect(
        splitCommitMessage(codeBlock`
          Update something

          Some body text
        `),
      ).toEqual({
        body: codeBlock`
          Update something

          Some body text
        `,
        trailers: [],
      });
    });

    it('splits a trailing trailer block from the body', () => {
      expect(
        splitCommitMessage(codeBlock`
          Update something

          Some body text

          Signed-off-by: Renovate Bot <bot@renovateapp.com>
          Co-authored-by: First Contributor <first@example.com>
        `),
      ).toEqual({
        body: codeBlock`
          Update something

          Some body text
        `,
        trailers: [
          'Signed-off-by: Renovate Bot <bot@renovateapp.com>',
          'Co-authored-by: First Contributor <first@example.com>',
        ],
      });
    });

    it('treats a single-line subject with no trailers as body only', () => {
      expect(splitCommitMessage('Update something')).toEqual({
        body: 'Update something',
        trailers: [],
      });
    });

    it('handles an empty message', () => {
      expect(splitCommitMessage('')).toEqual({ body: '', trailers: [] });
      expect(splitCommitMessage('\n')).toEqual({ body: '', trailers: [] });
    });

    it('treats a message that is only trailers as an empty body', () => {
      expect(
        splitCommitMessage(codeBlock`
          Signed-off-by: Renovate Bot <bot@renovateapp.com>
          Change-Id: Iabc
        `),
      ).toEqual({
        body: '',
        trailers: [
          'Signed-off-by: Renovate Bot <bot@renovateapp.com>',
          'Change-Id: Iabc',
        ],
      });
    });
  });
});
