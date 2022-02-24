import * as httpMock from '../../../test/http-mock';
import { setBaseUrl } from '../../util/http/bitbucket';
import * as comments from './comments';

const baseUrl = 'https://api.bitbucket.org';

describe('platform/bitbucket/comments', () => {
  const config: comments.CommentsConfig = { repository: 'some/repo' };

  beforeEach(() => {
    jest.clearAllMocks();

    setBaseUrl(baseUrl);
  });

  describe('ensureComment()', () => {
    it('does not throw', async () => {
      expect.assertions(2);
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
        })
      ).toBeFalse();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('add comment if not found', async () => {
      expect.assertions(2);
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
        })
      ).toBeTrue();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('add updates comment if necessary', async () => {
      expect.assertions(2);
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
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('skips comment', async () => {
      expect.assertions(2);
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
        })
      ).toBeTrue();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('ensureCommentRemoval()', () => {
    it('does not throw', async () => {
      expect.assertions(1);
      httpMock
        .scope(baseUrl)
        .get('/2.0/repositories/some/repo/pullrequests/5/comments?pagelen=100')
        .reply(200, { values: [] });
      await comments.ensureCommentRemoval(config, {
        type: 'by-topic',
        number: 5,
        topic: 'topic',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
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

      await comments.ensureCommentRemoval(config, {
        type: 'by-topic',
        number: 5,
        topic: 'some-subject',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
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

      await comments.ensureCommentRemoval(config, {
        type: 'by-content',
        number: 5,
        content: 'some-content',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('deletes nothing', async () => {
      expect.assertions(1);
      httpMock
        .scope(baseUrl)
        .get('/2.0/repositories/some/repo/pullrequests/5/comments?pagelen=100')
        .reply(200, { values: [] });
      await comments.ensureCommentRemoval(config, {
        type: 'by-topic',
        number: 5,
        topic: 'topic',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
