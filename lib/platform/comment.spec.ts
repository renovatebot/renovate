import { mocked, platform } from '../../test/util';
import * as _cache from '../util/cache/repository';
import type { Cache } from '../util/cache/repository/types';
import { ensureComment, ensureCommentRemoval } from './comment';

jest.mock('.');
jest.mock('../util/cache/repository');

const cache = mocked(_cache);

describe('platform/comment', () => {
  let repoCache: Cache = {};
  beforeEach(() => {
    repoCache = {};
    jest.resetAllMocks();
    cache.getCache.mockReturnValue(repoCache);
  });

  describe('ensureComment', () => {
    it('caches created comment', async () => {
      platform.ensureComment.mockResolvedValueOnce(true);

      const res = await ensureComment({
        number: 1,
        topic: 'foo',
        content: 'bar',
      });

      expect(res).toBe(true);
      expect(repoCache).toEqual({
        prComments: { '1': { foo: '37b51d194a7513e45b56f6524f2d51f2' } },
      });
    });

    it('caches comment with no topic', async () => {
      platform.ensureComment.mockResolvedValueOnce(true);

      const res = await ensureComment({
        number: 1,
        topic: null,
        content: 'bar',
      });

      expect(res).toBe(true);
      expect(repoCache).toEqual({
        prComments: { '1': { '': '37b51d194a7513e45b56f6524f2d51f2' } },
      });
    });

    it('does not cache failed comment', async () => {
      platform.ensureComment.mockResolvedValueOnce(false);

      const res = await ensureComment({
        number: 1,
        topic: 'foo',
        content: 'bar',
      });

      expect(res).toBe(false);
      expect(repoCache).toBeEmpty();
    });

    it('short-circuits if comment already exists', async () => {
      platform.ensureComment.mockResolvedValue(true);

      await ensureComment({ number: 1, topic: 'aaa', content: '111' });
      await ensureComment({ number: 1, topic: 'aaa', content: '111' });

      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
    });

    it('rewrites content hash', async () => {
      platform.ensureComment.mockResolvedValue(true);

      await ensureComment({ number: 1, topic: 'aaa', content: '111' });
      await ensureComment({ number: 1, topic: 'aaa', content: '222' });

      expect(platform.ensureComment).toHaveBeenCalledTimes(2);
      expect(repoCache).toEqual({
        prComments: { '1': { aaa: 'bcbe3365e6ac95ea2c0343a2395834dd' } },
      });
    });

    it('caches comments many comments with different topics', async () => {
      platform.ensureComment.mockResolvedValue(true);

      await ensureComment({ number: 1, topic: 'aaa', content: '111' });
      await ensureComment({ number: 1, topic: 'aaa', content: '111' });

      await ensureComment({ number: 1, topic: 'bbb', content: '111' });
      await ensureComment({ number: 1, topic: 'bbb', content: '111' });

      expect(platform.ensureComment).toHaveBeenCalledTimes(2);
      expect(repoCache).toEqual({
        prComments: {
          '1': {
            aaa: '698d51a19d8a121ce581499d7b701668',
            bbb: '698d51a19d8a121ce581499d7b701668',
          },
        },
      });
    });
  });

  describe('ensureCommentRemoval', () => {
    beforeEach(() => {
      platform.ensureCommentRemoval.mockResolvedValueOnce();
      platform.ensureComment.mockResolvedValue(true);
    });

    it('deletes cached comment by topic', async () => {
      await ensureComment({ number: 1, topic: 'aaa', content: '111' });
      await ensureCommentRemoval({ number: 1, topic: 'aaa' });
      expect(repoCache).toEqual({
        prComments: { '1': {} },
      });
    });

    it('deletes cached comment by content', async () => {
      await ensureComment({ number: 1, topic: 'aaa', content: '111' });
      await ensureCommentRemoval({ number: 1, content: '111' });
      expect(repoCache).toEqual({
        prComments: { '1': {} },
      });
    });

    it('deletes by content only one comment', async () => {
      await ensureComment({ number: 1, topic: 'aaa', content: '111' });
      await ensureComment({ number: 1, topic: 'bbb', content: '111' });
      await ensureCommentRemoval({ number: 1, content: '111' });
      expect(repoCache).toEqual({
        prComments: { '1': { bbb: '698d51a19d8a121ce581499d7b701668' } },
      });
    });

    it('deletes only for selected PR', async () => {
      await ensureComment({ number: 1, topic: 'aaa', content: '111' });
      await ensureComment({ number: 2, topic: 'aaa', content: '111' });
      await ensureCommentRemoval({ number: 1, content: '111' });
      expect(repoCache).toEqual({
        prComments: {
          '1': {},
          '2': { aaa: '698d51a19d8a121ce581499d7b701668' },
        },
      });
    });
  });
});
