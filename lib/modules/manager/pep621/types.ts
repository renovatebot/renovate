export interface Pep508ParseResult {
  packageName: string;
  currentValue?: string;
  extras?: string[];
  marker?: string;
}

export interface Pep621ManagerData {
  depGroup?: string;
  /**
   * Whether the lock file holds this dependency at more than one version, so
   * that it cannot be upgraded to a pinned one.
   */
  hasMultipleLockedEntries?: boolean;
}
