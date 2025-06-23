import { getCache } from '../../util/cache/repository';
import { hash } from '../../util/hash';
import type { EnsureCommentConfig, EnsureCommentRemovalConfig } from './types';
import { platform } from '.';

export async function ensureComment(
  commentConfig: EnsureCommentConfig,
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
  config: EnsureCommentRemovalConfig,
): Promise<void> {
  await platform.ensureCommentRemoval(config);

  const repoCache = getCache();

  const { type, number } = config;
  if (repoCache.prComments?.[number]) {
    if (type === 'by-topic') {
      delete repoCache.prComments?.[number]?.[config.topic];
    } else if (type === 'by-content') {
      const contentHash = hash(config.content);
      for (const [cachedTopic, cachedContentHash] of Object.entries(
        repoCache.prComments?.[number],
      )) {
        if (cachedContentHash === contentHash) {
          delete repoCache.prComments?.[number]?.[cachedTopic];
          return;
        }
      }
    }
  }
}
