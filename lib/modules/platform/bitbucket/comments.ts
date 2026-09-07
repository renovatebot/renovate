import { logger } from '../../../logger/index.ts';
import { BitbucketHttp } from '../../../util/http/bitbucket.ts';
import type {
  EnsureCommentConfig,
  EnsureCommentRemovalConfig,
} from '../types.ts';
import {
  ensureCommentRemovalWith,
  ensureCommentWith,
} from '../utils/comments.ts';
import type { Account, CommentsConfig, PagedResult } from './types.ts';

export const REOPEN_PR_COMMENT_KEYWORD = 'reopen!';

const bitbucketHttp = new BitbucketHttp();

interface Comment {
  content: { raw: string };
  id: number;
  user: Account;
}

interface EnsureBitbucketCommentConfig extends EnsureCommentConfig {
  config: CommentsConfig;
}

async function getComments(
  config: CommentsConfig,
  prNo: number,
): Promise<Comment[]> {
  const comments = (
    await bitbucketHttp.getJsonUnchecked<PagedResult<Comment>>(
      `/2.0/repositories/${config.repository}/pullrequests/${prNo}/comments`,
      {
        paginate: true,
      },
    )
  ).body.values;

  logger.debug(`Found ${comments.length} comments`);
  return comments;
}

async function addComment(
  config: CommentsConfig,
  prNo: number,
  raw: string,
): Promise<void> {
  await bitbucketHttp.postJson(
    `/2.0/repositories/${config.repository}/pullrequests/${prNo}/comments`,
    {
      body: { content: { raw } },
    },
  );
}

async function editComment(
  config: CommentsConfig,
  prNo: number,
  commentId: number,
  raw: string,
): Promise<void> {
  await bitbucketHttp.putJson(
    `/2.0/repositories/${config.repository}/pullrequests/${prNo}/comments/${commentId}`,
    {
      body: { content: { raw } },
    },
  );
}

async function deleteComment(
  config: CommentsConfig,
  prNo: number,
  commentId: number,
): Promise<void> {
  await bitbucketHttp.deleteJson(
    `/2.0/repositories/${config.repository}/pullrequests/${prNo}/comments/${commentId}`,
  );
}

export async function ensureComment({
  config,
  number: prNo,
  topic,
  content,
}: EnsureBitbucketCommentConfig): Promise<boolean> {
  try {
    return await ensureCommentWith(
      { number: prNo, topic, content },
      {
        getComments: () => getComments(config, prNo),
        getBody: (comment) => comment.content.raw,
        // sanitize on the way out only, so that the comparison with the
        // existing comment keeps using the unsanitized body
        addComment: (body) =>
          addComment(config, prNo, sanitizeCommentBody(body)),
        editComment: (comment, body) =>
          editComment(config, prNo, comment.id, sanitizeCommentBody(body)),
      },
    );
  } catch (err) /* v8 ignore next -- defensive: comment API failures are logged and swallowed, not simulated in specs */ {
    logger.warn({ err }, 'Error ensuring comment');
    return false;
  }
}

export async function reopenComments(
  config: CommentsConfig,
  prNo: number,
): Promise<Comment[]> {
  const comments = await getComments(config, prNo);

  const reopenComments = comments.filter((comment) =>
    comment.content.raw.startsWith(REOPEN_PR_COMMENT_KEYWORD),
  );

  return reopenComments;
}

export async function ensureCommentRemoval(
  config: CommentsConfig,
  deleteConfig: EnsureCommentRemovalConfig,
): Promise<void> {
  const { number: prNo } = deleteConfig;
  try {
    await ensureCommentRemovalWith(deleteConfig, {
      getComments: () => getComments(config, prNo),
      getBody: (comment) => comment.content.raw,
      deleteComment: (comment) => deleteComment(config, prNo, comment.id),
    });
  } catch (err) /* v8 ignore next -- defensive: comment API failures are logged and swallowed, not simulated in specs */ {
    logger.warn({ err }, 'Error ensuring comment removal');
  }
}

function sanitizeCommentBody(body: string): string {
  return body
    .replace(
      'checking the rebase/retry box above',
      'renaming this PR to start with "rebase!"',
    )
    .replace(
      'rename this PR to get a fresh replacement',
      'add a comment starting with "reopen!" to get a fresh replacement',
    );
}
