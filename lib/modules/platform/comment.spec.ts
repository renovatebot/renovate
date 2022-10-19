import { mocked, platform } from '../../../test/util';
import * as _cache from '../../util/cache/repository';
import type { RepoCacheData } from '../../util/cache/repository/types';
import { ensureComment, ensureCommentRemoval } from './comment';

jest.mock('.');
jest.mock('../../util/cache/repository');

const cache = mocked(_cache);

describe('modules/platform/comment', () => {
  let repoCache: RepoCacheData = {};

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
        prComments: {
          '1': {
            foo: 'd82c4eb5261cb9c8aa9855edd67d1bd10482f41529858d925094d173fa662aa91ff39bc5b188615273484021dfb16fd8284cf684ccf0fc795be3aa2fc1e6c181',
          },
        },
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
        prComments: {
          '1': {
            '': 'd82c4eb5261cb9c8aa9855edd67d1bd10482f41529858d925094d173fa662aa91ff39bc5b188615273484021dfb16fd8284cf684ccf0fc795be3aa2fc1e6c181',
          },
        },
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
        prComments: {
          '1': {
            aaa: '5f28f24f5520230fd1e66ea6ac649e9f9637515f516b2ef74fc90622b60f165eafca8f34db8471b85b9b4a2cdf72f75099ae0eb8860c4f339252261778d406eb',
          },
        },
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
            aaa: 'fb131bc57a477c8c9d068f1ee5622ac304195a77164ccc2d75d82dfe1a727ba8d674ed87f96143b2b416aacefb555e3045c356faa23e6d21de72b85822e39fdd',
            bbb: 'fb131bc57a477c8c9d068f1ee5622ac304195a77164ccc2d75d82dfe1a727ba8d674ed87f96143b2b416aacefb555e3045c356faa23e6d21de72b85822e39fdd',
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
      await ensureCommentRemoval({ type: 'by-topic', number: 1, topic: 'aaa' });
      expect(repoCache).toEqual({
        prComments: { '1': {} },
      });
    });

    it('deletes cached comment by content', async () => {
      await ensureComment({ number: 1, topic: 'aaa', content: '111' });
      await ensureCommentRemoval({
        type: 'by-content',
        number: 1,
        content: '111',
      });
      expect(repoCache).toEqual({
        prComments: { '1': {} },
      });
    });

    it('deletes by content only one comment', async () => {
      await ensureComment({ number: 1, topic: 'aaa', content: '111' });
      await ensureComment({ number: 1, topic: 'bbb', content: '111' });
      await ensureCommentRemoval({
        type: 'by-content',
        number: 1,
        content: '111',
      });
      expect(repoCache).toEqual({
        prComments: {
          '1': {
            bbb: 'fb131bc57a477c8c9d068f1ee5622ac304195a77164ccc2d75d82dfe1a727ba8d674ed87f96143b2b416aacefb555e3045c356faa23e6d21de72b85822e39fdd',
          },
        },
      });
    });

    it('deletes only for selected PR', async () => {
      await ensureComment({ number: 1, topic: 'aaa', content: '111' });
      await ensureComment({ number: 2, topic: 'aaa', content: '111' });
      await ensureCommentRemoval({
        type: 'by-content',
        number: 1,
        content: '111',
      });
      expect(repoCache).toEqual({
        prComments: {
          '1': {},
          '2': {
            aaa: 'fb131bc57a477c8c9d068f1ee5622ac304195a77164ccc2d75d82dfe1a727ba8d674ed87f96143b2b416aacefb555e3045c356faa23e6d21de72b85822e39fdd',
          },
        },
      });
    });
  });
});
