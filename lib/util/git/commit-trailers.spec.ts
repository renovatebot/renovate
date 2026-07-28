import { codeBlock } from 'common-tags';
import { logger } from '~test/util.ts';
import {
  filterValidCommitTrailers,
  formatCommitMessage,
  isValidCommitTrailer,
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

  describe('formatCommitMessage', () => {
    it('returns string message unchanged when there are no trailers', () => {
      expect(formatCommitMessage('Update something')).toBe('Update something');
    });

    it('joins array message parts with blank lines', () => {
      expect(formatCommitMessage(['Update something', 'Some commit body']))
        .toBe(codeBlock`
        Update something

        Some commit body
      `);
    });

    it('appends trailers as the final block for a string message', () => {
      expect(
        formatCommitMessage('Update something', [
          'Signed-off-by: Renovate Bot <bot@renovateapp.com>',
          'Co-authored-by: First Contributor <first@example.com>',
        ]),
      ).toBe(codeBlock`
        Update something

        Signed-off-by: Renovate Bot <bot@renovateapp.com>
        Co-authored-by: First Contributor <first@example.com>
      `);
    });

    it('appends trailers as the final block for an array message', () => {
      expect(
        formatCommitMessage(
          ['Update something', 'Some commit body'],
          ['Signed-off-by: Renovate Bot <bot@renovateapp.com>'],
        ),
      ).toBe(codeBlock`
        Update something

        Some commit body

        Signed-off-by: Renovate Bot <bot@renovateapp.com>
      `);
    });

    it('ignores empty trailer lists', () => {
      expect(formatCommitMessage('Update something', [])).toBe(
        'Update something',
      );
    });
  });
});
