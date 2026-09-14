import { logger } from '../../../logger/index.ts';
import { compileCommitBodyAndTrailers } from './commit-body.ts';

describe('workers/repository/model/commit-body', () => {
  describe('compileCommitBodyAndTrailers()', () => {
    it('returns the message unchanged when nothing is configured', () => {
      const res = compileCommitBodyAndTrailers({}, 'Add renovate.json', {});

      expect(res).toEqual({
        message: 'Add renovate.json',
        trailers: undefined,
      });
    });

    it('appends the compiled commitBody', () => {
      const res = compileCommitBodyAndTrailers(
        { commitBody: 'Signed off by {{{gitAuthor}}}' },
        'Add renovate.json',
        { gitAuthor: 'Bot <bot@botland.com>' },
      );

      expect(res).toEqual({
        message: 'Add renovate.json\n\nSigned off by Bot <bot@botland.com>',
        trailers: undefined,
      });
    });

    it('compiles the trailers with their own context', () => {
      const res = compileCommitBodyAndTrailers(
        {
          commitBody: '{{{body}}}',
          commitTrailers: ['Signed-off-by: {{{gitAuthor}}}'],
        },
        'Add renovate.json',
        { body: 'from the body context' },
        { gitAuthor: 'Bot <bot@botland.com>' },
      );

      expect(res).toEqual({
        message: 'Add renovate.json\n\nfrom the body context',
        trailers: ['Signed-off-by: Bot <bot@botland.com>'],
      });
    });

    it('drops trailers that are invalid after compilation', () => {
      const res = compileCommitBodyAndTrailers(
        {
          commitTrailers: [
            'Signed-off-by: {{{gitAuthor}}}',
            'Static-Trailer: kept',
          ],
        },
        'Add renovate.json',
        { gitAuthor: '' },
      );

      expect(res.trailers).toEqual(['Static-Trailer: kept']);
      expect(logger.warn).toHaveBeenCalledWith(
        { invalid: ['Signed-off-by: '] },
        'Ignoring invalid commit trailers (must be a single-line Key: value)',
      );
    });
  });
});
