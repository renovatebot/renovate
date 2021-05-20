import { logger } from '../../logger';
import { BitbucketHttp } from '../../util/http/bitbucket';
import type { EnsureCommentConfig } from '../types';
import { Config, accumulateValues } from './utils';

const bitbucketHttp = new BitbucketHttp();

interface Comment {
  content: { raw: string };
  id: number;
}

export type CommentsConfig = Pick<Config, 'repository'>;

interface EnsureBitBucketCommentConfig extends EnsureCommentConfig {
  config: CommentsConfig;
}

async function getComments(
  config: CommentsConfig,
  prNo: number
): Promise<Comment[]> {
  const comments = await accumulateValues<Comment>(
    `/2.0/repositories/${config.repository}/pullrequests/${prNo}/comments`
  );

  logger.debug(`Found ${comments.length} comments`);
  return comments;
}

async function addComment(
  config: CommentsConfig,
  prNo: number,
  raw: string
): Promise<void> {
  await bitbucketHttp.postJson(
    `/2.0/repositories/${config.repository}/pullrequests/${prNo}/comments`,
    {
      body: { content: { raw } },
    }
  );
}

async function editComment(
  config: CommentsConfig,
  prNo: number,
  commentId: number,
  raw: string
): Promise<void> {
  await bitbucketHttp.putJson(
    `/2.0/repositories/${config.repository}/pullrequests/${prNo}/comments/${commentId}`,
    {
      body: { content: { raw } },
    }
  );
}

async function deleteComment(
  config: CommentsConfig,
  prNo: number,
  commentId: number
): Promise<void> {
  await bitbucketHttp.deleteJson(
    `/2.0/repositories/${config.repository}/pullrequests/${prNo}/comments/${commentId}`
  );
}

export async function ensureComment({
  config,
  number: prNo,
  topic,
  content,
}: EnsureBitBucketCommentConfig): Promise<boolean> {
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
    if (!commentId) {
      await addComment(config, prNo, body);
      logger.info(
        { repository: config.repository, prNo, topic },
        'Comment added'
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

export async function ensureCommentRemoval(
  config: CommentsConfig,
  prNo: number,
  topic?: string,
  content?: string
): Promise<void> {
  try {
    logger.debug(
      `Ensuring comment "${topic || content}" in #${prNo} is removed`
    );
    const comments = await getComments(config, prNo);

    const byTopic = (comment: Comment): boolean =>
      comment.content.raw.startsWith(`### ${topic}\n\n`);
    const byContent = (comment: Comment): boolean =>
      comment.content.raw.trim() === content;

    let commentId: number | null = null;

    if (topic) {
      commentId = comments.find(byTopic)?.id;
    } else if (content) {
      commentId = comments.find(byContent)?.id;
    }

    if (commentId) {
      await deleteComment(config, prNo, commentId);
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error ensuring comment removal');
  }
}
