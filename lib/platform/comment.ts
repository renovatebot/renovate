import hasha from 'hasha';
import { getCache } from '../util/cache/repository';
import type {
  EnsureCommentConfig,
  EnsureCommentRemovalConfigByContent,
  EnsureCommentRemovalConfigByTopic,
} from './types';
import { platform } from '.';

const hash = (content: string): string => hasha(content, { algorithm: 'sha1' });

export async function ensureComment(
  commentConfig: EnsureCommentConfig
): Promise<boolean> {
  const { number, content } = commentConfig;
  const topic = commentConfig.topic ?? '';

  const contentHash = hash(content);
  const repoCache = getCache();

  if (contentHash !== repoCache.prComments?.[number]?.[topic]) {
    const res = await platform.ensureComment(commentConfig);
    if (res) {
      repoCache.prComments ??= {};
      repoCache.prComments[number] ??= {};
      repoCache.prComments[number][topic] = contentHash;
    }
    return res;
  }

  return true;
}

export async function ensureCommentRemoval(
  config:
    | EnsureCommentRemovalConfigByTopic
    | EnsureCommentRemovalConfigByContent
): Promise<void> {
  await platform.ensureCommentRemoval(config);

  const { number, topic, content } = { topic: null, content: null, ...config };
  const repoCache = getCache();
  if (repoCache.prComments?.[number]) {
    if (topic) {
      delete repoCache.prComments?.[number]?.[topic];
    }
    if (content) {
      const contentHash = hash(content);
      for (const [cachedTopic, cachedContentHash] of Object.entries(
        repoCache.prComments?.[number]
      )) {
        if (cachedContentHash === contentHash) {
          delete repoCache.prComments?.[number]?.[cachedTopic];
          return;
        }
      }
    }
  }
}
