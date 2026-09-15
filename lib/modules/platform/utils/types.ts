import type { PlatformId } from '../../../constants/platforms.ts';

/**
 * Reads the raw markdown body out of a platform-specific comment object.
 */
export type CommentBodyAccessor<T> = (comment: T) => string | undefined;

export interface EnsureCommentOps<T> {
  getComments(): Promise<T[]>;
  getBody: CommentBodyAccessor<T>;
  /**
   * Adds the comment. Returning `false` aborts: `ensureCommentWith` then
   * returns `false` without reporting the comment as added.
   */
  addComment(body: string): Promise<boolean | void>;
  editComment(comment: T, body: string): Promise<void>;

  /**
   * Rewrites the topic before it is used to look up an existing comment.
   */
  massageTopic?(topic: string): string;

  /**
   * Rewrites the assembled body before it is compared against existing
   * comments. Platforms which must only massage the body they send should do
   * so inside `addComment`/`editComment` instead.
   */
  massageBody?(body: string): string;
}

export interface EnsureCommentRemovalOps<T> {
  getComments(): Promise<T[]>;
  getBody: CommentBodyAccessor<T>;
  deleteComment(comment: T): Promise<void>;
}

/**
 * The part of the persisted PR cache which is the same for every platform. Platforms add their own timestamp field on top, because its name and format differ per API.
 */
export interface BasePrCacheData<TPr> {
  items: Record<number, TPr>;
  author: string | null;
}

export interface PrCacheOptions<TData> {
  /** Key of the platform within the repository cache. */
  platform: PlatformId;
  author: string | null;
  /** Creates the empty cache which is used when nothing can be reused. */
  createCache: () => TData;
  /** Discards an otherwise reusable cache, for example when it uses an outdated format. */
  isOutdated?: (cache: TData) => boolean;
}
