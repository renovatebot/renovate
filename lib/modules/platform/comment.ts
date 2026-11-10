import { getCache } from '../../util/cache/repository/index.ts';
import { hash } from '../../util/hash.ts';
import { platform } from './index.ts';
import type {
  EnsureCommentConfig,
  EnsureCommentRemovalConfig,
} from './types.ts';

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
  // v8 ignore else -- TODO: add test #40625
  if (repoCache.prComments?.[number]) {
    // v8 ignore else -- TODO: add test #40625
    if (type === 'by-topic') {
      delete repoCache.prComments?.[number]?.[config.topic];
    } else if (type === 'by-content') {
      const contentHash = hash(config.content);
      for (const [cachedTopic, cachedContentHash] of Object.entries(
        repoCache.prComments?.[number],
      )) {
        // v8 ignore else -- TODO: add test #40625
        if (cachedContentHash === contentHash) {
          delete repoCache.prComments?.[number]?.[cachedTopic];
          return;
        }
      }
    }
  }
}
