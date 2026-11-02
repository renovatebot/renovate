import { logger } from '../../../logger/index.ts';
import { compileCommitBody, compileCommitTrailers } from './commit-body.ts';

describe('workers/repository/model/commit-body', () => {
  describe('compileCommitBody()', () => {
    it('returns the message unchanged when no commitBody is configured', () => {
      expect(compileCommitBody({}, 'Add renovate.json', {})).toBe(
        'Add renovate.json',
      );
    });

    it('appends the compiled commitBody', () => {
      const res = compileCommitBody(
        { commitBody: 'Signed off by {{{gitAuthor}}}' },
        'Add renovate.json',
        { gitAuthor: 'Bot <bot@botland.com>' },
      );

      expect(res).toBe(
        'Add renovate.json\n\nSigned off by Bot <bot@botland.com>',
      );
    });

    it('removes URL credentials from the compiled body', () => {
      const res = compileCommitBody(
        { commitBody: 'Updates {{{depName}}}' },
        'Update dependency',
        { depName: 'https://user:secret@git.example.com/org/repo' },
      );

      expect(res).toBe(
        'Update dependency\n\nUpdates https://git.example.com/org/repo',
      );
    });
  });

  describe('compileCommitTrailers()', () => {
    it('returns undefined when no commitTrailers are configured', () => {
      expect(compileCommitTrailers({}, {})).toBeUndefined();
    });

    it('compiles the trailers', () => {
      const res = compileCommitTrailers(
        { commitTrailers: ['Signed-off-by: {{{gitAuthor}}}'] },
        { gitAuthor: 'Bot <bot@botland.com>' },
      );

      expect(res).toEqual(['Signed-off-by: Bot <bot@botland.com>']);
    });

    it('removes URL credentials from the compiled trailers', () => {
      const res = compileCommitTrailers(
        { commitTrailers: ['Updated-dependency: {{{depName}}}'] },
        { depName: 'https://user:secret@git.example.com/org/repo' },
      );

      expect(res).toEqual([
        'Updated-dependency: https://git.example.com/org/repo',
      ]);
    });

    it('drops trailers that are invalid after compilation', () => {
      const res = compileCommitTrailers(
        {
          commitTrailers: [
            'Signed-off-by: {{{gitAuthor}}}',
            'Static-Trailer: kept',
          ],
        },
        { gitAuthor: '' },
      );

      expect(res).toEqual(['Static-Trailer: kept']);
      expect(logger.warn).toHaveBeenCalledWith(
        { invalid: ['Signed-off-by: '] },
        'Ignoring invalid commit trailers (must be a single-line Key: value)',
      );
    });
  });
});
