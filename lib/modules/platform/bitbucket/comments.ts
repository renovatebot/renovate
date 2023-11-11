import { logger } from '../../../logger';
import { BitbucketHttp } from '../../../util/http/bitbucket';
import type { EnsureCommentConfig, EnsureCommentRemovalConfig } from '../types';
import type { Account, Config, PagedResult } from './types';

export const REOPEN_PR_COMMENT_KEYWORD = 'reopen!';

const bitbucketHttp = new BitbucketHttp();

interface Comment {
  content: { raw: string };
  id: number;
  user: Account;
}

export type CommentsConfig = Pick<Config, 'repository'>;

interface EnsureBitbucketCommentConfig extends EnsureCommentConfig {
  config: CommentsConfig;
}

async function getComments(
  config: CommentsConfig,
  prNo: number,
): Promise<Comment[]> {
  const comments = (
    await bitbucketHttp.getJson<PagedResult<Comment>>(
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
    const comments = await getComments(config, prNo);
    let body: string;
    let commentId: number | undefined;
    let commentNeedsUpdating: boolean | undefined;
    if (topic) {
      logger.debug(`Ensuring comment "${topic}" in #${prNo}`);
      body = `### ${topic}\n\n${content}`;
      comments.forEach((comment) => {
        if (comment.content.raw.startsWith(`### ${topic}\n\n`)) {
          commentId = comment.id;
          commentNeedsUpdating = comment.content.raw !== body;
        }
      });
    } else {
      logger.debug(`Ensuring content-only comment in #${prNo}`);
      body = `${content}`;
      comments.forEach((comment) => {
        if (comment.content.raw === body) {
          commentId = comment.id;
          commentNeedsUpdating = false;
        }
      });
    }

    // sanitize any language that isn't supported by Bitbucket Cloud
    body = sanitizeCommentBody(body);

    if (!commentId) {
      await addComment(config, prNo, body);
      logger.info(
        { repository: config.repository, prNo, topic },
        'Comment added',
      );
    } else if (commentNeedsUpdating) {
      await editComment(config, prNo, commentId, body);
      logger.debug({ repository: config.repository, prNo }, 'Comment updated');
    } else {
      logger.debug('Comment is already update-to-date');
    }
    return true;
  } catch (err) /* istanbul ignore next */ {
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
  try {
    const { number: prNo } = deleteConfig;
    const key =
      deleteConfig.type === 'by-topic'
        ? deleteConfig.topic
        : deleteConfig.content;
    logger.debug(`Ensuring comment "${key}" in #${prNo} is removed`);
    const comments = await getComments(config, prNo);

    let commentId: number | undefined = undefined;

    if (deleteConfig.type === 'by-topic') {
      const byTopic = (comment: Comment): boolean =>
        comment.content.raw.startsWith(`### ${deleteConfig.topic}\n\n`);
      commentId = comments.find(byTopic)?.id;
    } else if (deleteConfig.type === 'by-content') {
      const byContent = (comment: Comment): boolean =>
        comment.content.raw.trim() === deleteConfig.content;
      commentId = comments.find(byContent)?.id;
    }

    if (commentId) {
      await deleteComment(config, prNo, commentId);
    }
  } catch (err) /* istanbul ignore next */ {
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
