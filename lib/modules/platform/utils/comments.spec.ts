import type { Mock } from 'vitest';
import { logger } from '~test/util.ts';
import {
  ensureCommentRemovalWith,
  ensureCommentWith,
  findCommentByContent,
  findCommentByTopic,
} from './comments.ts';
import type { EnsureCommentOps, EnsureCommentRemovalOps } from './types.ts';

interface TestComment {
  id: number;
  body?: string;
}

function getBody(comment: TestComment): string | undefined {
  return comment.body;
}

describe('modules/platform/utils/comments', () => {
  describe('findCommentByTopic', () => {
    it('finds the first comment with a matching topic header', () => {
      const comments: TestComment[] = [
        { id: 1, body: 'unrelated' },
        { id: 2 },
        { id: 3, body: '### some-topic\n\nsome content' },
        { id: 4, body: '### some-topic\n\nother content' },
      ];

      expect(findCommentByTopic(comments, 'some-topic', getBody)).toEqual({
        id: 3,
        body: '### some-topic\n\nsome content',
      });
    });

    it('returns null when no comment matches', () => {
      const comments: TestComment[] = [{ id: 1, body: 'unrelated' }];

      expect(findCommentByTopic(comments, 'some-topic', getBody)).toBeNull();
    });
  });

  describe('findCommentByContent', () => {
    it('finds the first comment with matching trimmed content', () => {
      const comments: TestComment[] = [
        { id: 1 },
        { id: 2, body: '  some content\n' },
      ];

      expect(findCommentByContent(comments, 'some content', getBody)).toEqual({
        id: 2,
        body: '  some content\n',
      });
    });

    it('returns null when no comment matches', () => {
      const comments: TestComment[] = [{ id: 1, body: 'other content' }];

      expect(
        findCommentByContent(comments, 'some content', getBody),
      ).toBeNull();
    });
  });

  describe('ensureCommentWith', () => {
    let comments: TestComment[];
    let addComment: Mock<(body: string) => Promise<void>>;
    let editComment: Mock<
      (comment: TestComment, body: string) => Promise<void>
    >;

    function ops(
      extra: Partial<EnsureCommentOps<TestComment>> = {},
    ): EnsureCommentOps<TestComment> {
      return {
        getComments: () => Promise.resolve(comments),
        getBody,
        addComment,
        editComment,
        ...extra,
      };
    }

    beforeEach(() => {
      comments = [];
      addComment = vi.fn<(body: string) => Promise<void>>();
      editComment =
        vi.fn<(comment: TestComment, body: string) => Promise<void>>();
    });

    it('adds a topic comment when none exists', async () => {
      const res = await ensureCommentWith(
        { number: 42, topic: 'some-topic', content: 'some content' },
        ops(),
      );

      expect(res).toBe(true);
      expect(addComment).toHaveBeenCalledWith('### some-topic\n\nsome content');
      expect(editComment).not.toHaveBeenCalled();
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Ensuring comment "some-topic" in #42',
      );
      expect(logger.logger.info).toHaveBeenCalledWith(
        { issueNo: 42, topic: 'some-topic' },
        'Comment added',
      );
    });

    it('updates a topic comment whose body changed', async () => {
      comments = [{ id: 1, body: '### some-topic\n\nold content' }];

      const res = await ensureCommentWith(
        { number: 42, topic: 'some-topic', content: 'new content' },
        ops(),
      );

      expect(res).toBe(true);
      expect(addComment).not.toHaveBeenCalled();
      expect(editComment).toHaveBeenCalledWith(
        { id: 1, body: '### some-topic\n\nold content' },
        '### some-topic\n\nnew content',
      );
      expect(logger.logger.debug).toHaveBeenCalledWith(
        { issueNo: 42, topic: 'some-topic' },
        'Comment updated',
      );
    });

    it('leaves an up-to-date topic comment alone', async () => {
      comments = [{ id: 1, body: '### some-topic\n\nsome content' }];

      const res = await ensureCommentWith(
        { number: 42, topic: 'some-topic', content: 'some content' },
        ops(),
      );

      expect(res).toBe(true);
      expect(addComment).not.toHaveBeenCalled();
      expect(editComment).not.toHaveBeenCalled();
      expect(logger.logger.debug).toHaveBeenCalledWith(
        { issueNo: 42, topic: 'some-topic' },
        'Comment is already up-to-date',
      );
    });

    it('adds a content-only comment when none matches exactly', async () => {
      comments = [{ id: 1, body: '  some content\n' }];

      const res = await ensureCommentWith(
        { number: 42, topic: null, content: 'some content' },
        ops(),
      );

      expect(res).toBe(true);
      expect(addComment).toHaveBeenCalledWith('some content');
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Ensuring content-only comment in #42',
      );
    });

    it('leaves an exactly matching content-only comment alone', async () => {
      comments = [{ id: 1, body: 'some content' }];

      const res = await ensureCommentWith(
        { number: 42, topic: null, content: 'some content' },
        ops(),
      );

      expect(res).toBe(true);
      expect(addComment).not.toHaveBeenCalled();
      expect(editComment).not.toHaveBeenCalled();
    });

    it('applies the massageTopic and massageBody hooks', async () => {
      comments = [{ id: 1, body: '### massaged-topic\n\nold content' }];

      const res = await ensureCommentWith(
        { number: 42, topic: 'some-topic', content: 'some content' },
        ops({
          massageTopic: () => 'massaged-topic',
          massageBody: (body: string) => body.toUpperCase(),
        }),
      );

      expect(res).toBe(true);
      expect(editComment).toHaveBeenCalledWith(
        { id: 1, body: '### massaged-topic\n\nold content' },
        '### SOME-TOPIC\n\nSOME CONTENT',
      );
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Ensuring comment "massaged-topic" in #42',
      );
    });
  });

  describe('ensureCommentRemovalWith', () => {
    let comments: TestComment[];
    let deleteComment: Mock<(comment: TestComment) => Promise<void>>;

    function ops(): EnsureCommentRemovalOps<TestComment> {
      return {
        getComments: () => Promise.resolve(comments),
        getBody,
        deleteComment,
      };
    }

    beforeEach(() => {
      comments = [];
      deleteComment = vi.fn<(comment: TestComment) => Promise<void>>();
    });

    it('deletes the comment matching the topic', async () => {
      comments = [{ id: 1, body: '### some-topic\n\nsome content' }];

      await ensureCommentRemovalWith(
        { type: 'by-topic', number: 42, topic: 'some-topic' },
        ops(),
      );

      expect(deleteComment).toHaveBeenCalledWith({
        id: 1,
        body: '### some-topic\n\nsome content',
      });
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Ensuring comment "some-topic" in #42 is removed',
      );
    });

    it('deletes the comment matching the content', async () => {
      comments = [{ id: 1, body: 'some content\n' }];

      await ensureCommentRemovalWith(
        { type: 'by-content', number: 42, content: 'some content' },
        ops(),
      );

      expect(deleteComment).toHaveBeenCalledWith({
        id: 1,
        body: 'some content\n',
      });
    });

    it('does nothing when no comment matches', async () => {
      comments = [{ id: 1, body: 'unrelated' }];

      await ensureCommentRemovalWith(
        { type: 'by-topic', number: 42, topic: 'some-topic' },
        ops(),
      );

      expect(deleteComment).not.toHaveBeenCalled();
    });
  });
});
