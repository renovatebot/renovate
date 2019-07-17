import URL from 'url';
import { api as _api } from '../../../lib/platform/bitbucket/bb-got-wrapper';
import * as comments from '../../../lib/platform/bitbucket/comments';
import responses from './_fixtures/responses';

jest.mock('../../../lib/platform/bitbucket/bb-got-wrapper');

const api: jest.Mocked<typeof _api> = _api as any;

describe('platform/comments', () => {
  const config: comments.CommentsConfig = { repository: 'some/repo' };

  async function mockedGet(path: string) {
    const uri = URL.parse(path).pathname!;
    let body = (responses as any)[uri];
    if (!body) {
      throw new Error('Missing request');
    }
    if (typeof body === 'function') {
      body = await body();
    }
    return { body } as any;
  }

  beforeAll(() => {
    api.get.mockImplementation(mockedGet);
    api.post.mockImplementation(mockedGet);
    api.put.mockImplementation(mockedGet);
    api.delete.mockImplementation(mockedGet);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureComment()', () => {
    it('does not throw', async () => {
      expect.assertions(2);
      expect(await comments.ensureComment(config, 3, 'topic', 'content')).toBe(
        false
      );
      expect(api.get.mock.calls).toMatchSnapshot();
    });

    it('add comment if not found', async () => {
      expect.assertions(6);
      api.get.mockClear();

      expect(await comments.ensureComment(config, 5, 'topic', 'content')).toBe(
        true
      );
      expect(api.get.mock.calls).toMatchSnapshot();
      expect(api.post).toHaveBeenCalledTimes(1);

      api.get.mockClear();
      api.post.mockClear();

      expect(await comments.ensureComment(config, 5, null, 'content')).toBe(
        true
      );
      expect(api.get.mock.calls).toMatchSnapshot();
      expect(api.post).toHaveBeenCalledTimes(1);
    });

    it('add updates comment if necessary', async () => {
      expect.assertions(8);
      api.get.mockClear();

      expect(
        await comments.ensureComment(config, 5, 'some-subject', 'some\ncontent')
      ).toBe(true);
      expect(api.get.mock.calls).toMatchSnapshot();
      expect(api.post).toHaveBeenCalledTimes(0);
      expect(api.put).toHaveBeenCalledTimes(1);

      api.get.mockClear();
      api.put.mockClear();

      expect(
        await comments.ensureComment(config, 5, null, 'some\ncontent')
      ).toBe(true);
      expect(api.get.mock.calls).toMatchSnapshot();
      expect(api.post).toHaveBeenCalledTimes(1);
      expect(api.put).toHaveBeenCalledTimes(0);
    });

    it('skips comment', async () => {
      expect.assertions(6);
      api.get.mockClear();

      expect(
        await comments.ensureComment(config, 5, 'some-subject', 'blablabla')
      ).toBe(true);
      expect(api.get.mock.calls).toMatchSnapshot();
      expect(api.put).toHaveBeenCalledTimes(0);

      api.get.mockClear();
      api.put.mockClear();

      expect(await comments.ensureComment(config, 5, null, '!merge')).toBe(
        true
      );
      expect(api.get.mock.calls).toMatchSnapshot();
      expect(api.put).toHaveBeenCalledTimes(0);
    });
  });

  describe('ensureCommentRemoval()', () => {
    it('does not throw', async () => {
      expect.assertions(1);
      await comments.ensureCommentRemoval(config, 5, 'topic');
      expect(api.get.mock.calls).toMatchSnapshot();
    });

    it('deletes comment if found', async () => {
      expect.assertions(2);
      api.get.mockClear();

      await comments.ensureCommentRemoval(config, 5, 'some-subject');
      expect(api.get.mock.calls).toMatchSnapshot();
      expect(api.delete).toHaveBeenCalledTimes(1);
    });

    it('deletes nothing', async () => {
      expect.assertions(2);
      api.get.mockClear();

      await comments.ensureCommentRemoval(config, 5, 'topic');
      expect(api.get.mock.calls).toMatchSnapshot();
      expect(api.delete).toHaveBeenCalledTimes(0);
    });
  });
});
