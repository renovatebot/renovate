/**
 * Reads the raw markdown body out of a platform-specific comment object.
 */
export type CommentBodyAccessor<T> = (comment: T) => string | undefined;

export interface EnsureCommentOps<T> {
  getComments(): Promise<T[]>;
  getBody: CommentBodyAccessor<T>;
  addComment(body: string): Promise<void>;
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
