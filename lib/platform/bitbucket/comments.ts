import { logger } from '../../logger';
import { Config, accumulateValues } from './utils';
import { api } from './bb-got-wrapper';

interface Comment {
  content: { raw: string };
  id: number;
}

export type CommentsConfig = Pick<Config, 'repository'>;

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
  await api.post(
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
  await api.put(
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
  await api.delete(
    `/2.0/repositories/${config.repository}/pullrequests/${prNo}/comments/${commentId}`
  );
}

export async function ensureComment(
  config: CommentsConfig,
  prNo: number,
  topic: string | null,
  content: string
): Promise<boolean> {
  try {
    const comments = await getComments(config, prNo);
    let body: string;
    let commentId: number | undefined;
    let commentNeedsUpdating: boolean | undefined;
    if (topic) {
      logger.debug(`Ensuring comment "${topic}" in #${prNo}`);
      body = `### ${topic}\n\n${content}`;
      comments.forEach(comment => {
        if (comment.content.raw.startsWith(`### ${topic}\n\n`)) {
          commentId = comment.id;
          commentNeedsUpdating = comment.content.raw !== body;
        }
      });
    } else {
      logger.debug(`Ensuring content-only comment in #${prNo}`);
      body = `${content}`;
      comments.forEach(comment => {
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
      logger.info({ repository: config.repository, prNo }, 'Comment updated');
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
  topic: string
): Promise<void> {
  try {
    logger.debug(`Ensuring comment "${topic}" in #${prNo} is removed`);
    const comments = await getComments(config, prNo);
    let commentId: number;
    comments.forEach(comment => {
      if (comment.content.raw.startsWith(`### ${topic}\n\n`)) {
        commentId = comment.id;
      }
    });
    if (commentId) {
      await deleteComment(config, prNo, commentId);
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error ensuring comment removal');
  }
}
