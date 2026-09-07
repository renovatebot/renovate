import { logger } from '../../../logger/index.ts';
import type {
  EnsureCommentConfig,
  EnsureCommentRemovalConfig,
} from '../types.ts';
import type {
  CommentBodyAccessor,
  EnsureCommentOps,
  EnsureCommentRemovalOps,
} from './types.ts';

function topicHeader(topic: string): string {
  return `### ${topic}\n\n`;
}

/**
 * Finds the first comment whose body starts with the `### <topic>` header.
 */
export function findCommentByTopic<T>(
  comments: T[],
  topic: string,
  getBody: CommentBodyAccessor<T>,
): T | null {
  const header = topicHeader(topic);
  return (
    comments.find((comment) => getBody(comment)?.startsWith(header)) ?? null
  );
}

/**
 * Finds the first comment whose trimmed body equals the given content.
 */
export function findCommentByContent<T>(
  comments: T[],
  content: string,
  getBody: CommentBodyAccessor<T>,
): T | null {
  return (
    comments.find((comment) => getBody(comment)?.trim() === content) ?? null
  );
}

/**
 * Ensures a comment with the given topic and content exists on an issue or PR.
 *
 * The caller supplies the platform's comment primitives; errors from them are
 * not handled here, so wrap the call if the platform swallows them.
 */
export async function ensureCommentWith<T>(
  { number, topic, content }: EnsureCommentConfig,
  ops: EnsureCommentOps<T>,
): Promise<boolean> {
  const searchTopic = topic ? (ops.massageTopic?.(topic) ?? topic) : null;
  let body = topic ? `${topicHeader(topic)}${content}` : content;
  if (ops.massageBody) {
    body = ops.massageBody(body);
  }

  if (searchTopic) {
    logger.debug(`Ensuring comment "${searchTopic}" in #${number}`);
  } else {
    logger.debug(`Ensuring content-only comment in #${number}`);
  }

  const comments = await ops.getComments();
  const existingComment = searchTopic
    ? findCommentByTopic(comments, searchTopic, ops.getBody)
    : (comments.find((comment) => ops.getBody(comment) === body) ?? null);

  if (!existingComment) {
    await ops.addComment(body);
    logger.info({ issueNo: number, topic }, 'Comment added');
    return true;
  }

  if (ops.getBody(existingComment) === body) {
    logger.debug({ issueNo: number, topic }, 'Comment is already up-to-date');
    return true;
  }

  await ops.editComment(existingComment, body);
  logger.debug({ issueNo: number, topic }, 'Comment updated');
  return true;
}

/**
 * Removes the comment matching the given topic or content, if it exists.
 *
 * The caller supplies the platform's comment primitives; errors from them are
 * not handled here, so wrap the call if the platform swallows them.
 */
export async function ensureCommentRemovalWith<T>(
  config: EnsureCommentRemovalConfig,
  ops: EnsureCommentRemovalOps<T>,
): Promise<void> {
  const { number: issueNo } = config;
  const key = config.type === 'by-topic' ? config.topic : config.content;
  logger.debug(`Ensuring comment "${key}" in #${issueNo} is removed`);

  const comments = await ops.getComments();
  const comment =
    config.type === 'by-topic'
      ? findCommentByTopic(comments, config.topic, ops.getBody)
      : findCommentByContent(comments, config.content, ops.getBody);

  if (comment) {
    await ops.deleteComment(comment);
  }
}
