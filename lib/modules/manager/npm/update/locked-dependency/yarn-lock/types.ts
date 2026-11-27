export interface YarnLockEntry {
  dependencies?: Record<string, string>;
  integrity?: string;
  resolved?: string;
  version?: string;
}

export type YarnLock = Record<string, YarnLockEntry>;

export interface YarnLockEntrySummary {
  entry: YarnLockEntry;
  depNameConstraint: string;
  depName: string;
  constraint: string;
  topLevel?: boolean;
}

export interface YarnLockEntryUpdate extends YarnLockEntrySummary {
  newVersion: string;
}
