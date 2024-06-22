import * as httpMock from '../../../../test/http-mock';
import { setBaseUrl } from '../../../util/http/bitbucket';
import * as comments from './comments';

const baseUrl = 'https://api.bitbucket.org';

describe('modules/platform/bitbucket/comments', () => {
  const config: comments.CommentsConfig = { repository: 'some/repo' };

  beforeEach(() => {
    setBaseUrl(baseUrl);
  });

  describe('ensureComment()', () => {
    it('does not throw', async () => {
      expect.assertions(1);
      httpMock
        .scope(baseUrl)
        .get('/2.0/repositories/some/repo/pullrequests/3/comments?pagelen=100')
        .reply(200);
      expect(
        await comments.ensureComment({
          config,
          number: 3,
          topic: 'topic',
          content: 'content',
        }),
      ).toBeFalse();
    });

    it('add comment if not found', async () => {
      expect.assertions(1);
      httpMock
        .scope(baseUrl)
        .get('/2.0/repositories/some/repo/pullrequests/5/comments?pagelen=100')
        .reply(200, { values: [] })
        .post('/2.0/repositories/some/repo/pullrequests/5/comments')
        .reply(200);

      expect(
        await comments.ensureComment({
          config,
          number: 5,
          topic: 'topic',
          content: 'content',
        }),
      ).toBeTrue();
    });

    it('finds reopen comment', async () => {
      const prComment = {
        content: {
          raw: 'reopen! comment',
        },
        user: {
          display_name: 'Bob Smith',
          uuid: '{d2238482-2e9f-48b3-8630-de22ccb9e42f}',
          account_id: '123',
        },
      };

      expect.assertions(1);
      httpMock
        .scope(baseUrl)
        .get('/2.0/repositories/some/repo/pullrequests/5/comments?pagelen=100')
        .reply(200, {
          values: [prComment],
        });

      expect(await comments.reopenComments(config, 5)).toEqual([prComment]);
    });

    it('finds no reopen comment', async () => {
      const prComment = {
        content: {
          raw: 'comment',
        },
        user: {
          display_name: 'Bob Smith',
          uuid: '{d2238482-2e9f-48b3-8630-de22ccb9e42f}',
          account_id: '123',
        },
      };

      expect.assertions(1);
      httpMock
        .scope(baseUrl)
        .get('/2.0/repositories/some/repo/pullrequests/5/comments?pagelen=100')
        .reply(200, {
          values: [prComment],
        });

      expect(await comments.reopenComments(config, 5)).toBeEmptyArray();
    });

    it('add updates comment if necessary', async () => {
      expect.assertions(1);
      httpMock
        .scope(baseUrl)
        .get('/2.0/repositories/some/repo/pullrequests/5/comments?pagelen=100')
        .reply(200, {
          values: [
            {
              id: 5,
              content: { raw: '### some-subject\n\nsome\nobsolete\ncontent' },
            },
          ],
        })
        .put('/2.0/repositories/some/repo/pullrequests/5/comments/5')
        .reply(200);
      const res = await comments.ensureComment({
        config,
        number: 5,
        topic: 'some-subject',
        content: 'some\ncontent',
      });
      expect(res).toBeTrue();
    });

    it('skips comment', async () => {
      expect.assertions(1);
      httpMock
        .scope(baseUrl)
        .get('/2.0/repositories/some/repo/pullrequests/5/comments?pagelen=100')
        .reply(200, {
          values: [
            {
              id: 5,
              content: { raw: 'blablabla' },
            },
          ],
        });
      expect(
        await comments.ensureComment({
          config,
          number: 5,
          topic: null,
          content: 'blablabla',
        }),
      ).toBeTrue();
    });
  });

  describe('ensureCommentRemoval()', () => {
    it('does not throw', async () => {
      expect.assertions(1);
      httpMock
        .scope(baseUrl)
        .get('/2.0/repositories/some/repo/pullrequests/5/comments?pagelen=100')
        .reply(200, { values: [] });
      await expect(
        comments.ensureCommentRemoval(config, {
          type: 'by-topic',
          number: 5,
          topic: 'topic',
        }),
      ).toResolve();
    });

    it('deletes comment by topic if found', async () => {
      expect.assertions(1);
      httpMock
        .scope(baseUrl)
        .get('/2.0/repositories/some/repo/pullrequests/5/comments?pagelen=100')
        .reply(200, {
          values: [
            {
              id: 5,
              content: { raw: '### some-subject\n\nsome-content' },
            },
          ],
        })
        .delete('/2.0/repositories/some/repo/pullrequests/5/comments/5')
        .reply(200);

      await expect(
        comments.ensureCommentRemoval(config, {
          type: 'by-topic',
          number: 5,
          topic: 'some-subject',
        }),
      ).toResolve();
    });

    it('deletes comment by content if found', async () => {
      expect.assertions(1);
      httpMock
        .scope(baseUrl)
        .get('/2.0/repositories/some/repo/pullrequests/5/comments?pagelen=100')
        .reply(200, {
          values: [
            {
              id: 5,
              content: { raw: '\n\nsome-content\n\n' },
            },
          ],
        })
        .delete('/2.0/repositories/some/repo/pullrequests/5/comments/5')
        .reply(200);

      await expect(
        comments.ensureCommentRemoval(config, {
          type: 'by-content',
          number: 5,
          content: 'some-content',
        }),
      ).toResolve();
    });

    it('deletes nothing', async () => {
      expect.assertions(1);
      httpMock
        .scope(baseUrl)
        .get('/2.0/repositories/some/repo/pullrequests/5/comments?pagelen=100')
        .reply(200, { values: [] });

      await expect(
        comments.ensureCommentRemoval(config, {
          type: 'by-content',
          number: 5,
          content: 'topic',
        }),
      ).toResolve();
    });
  });
});
