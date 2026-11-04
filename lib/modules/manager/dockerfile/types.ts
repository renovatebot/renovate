export interface GetDepOptions {
  /** Whether to set `replaceString` and `autoReplaceStringTemplate`. */
  specifyReplaceString?: boolean;
  registryAliases?: Record<string, string>;
  /** Set on the returned dependency, including on skipped ones. */
  depType?: string;
}
