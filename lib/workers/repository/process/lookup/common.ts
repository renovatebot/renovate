export interface LookupUpdate {
  blockedByPin?: boolean;
  branchName?: string;
  commitMessageAction?: string;
  displayFrom?: string;
  displayTo?: string;
  isLockfileUpdate?: boolean;
  isPin?: boolean;
  isRange?: boolean;
  isRollback?: boolean;
  isSingleVersion?: boolean;
  fromVersion?: string;
  newDigest?: string;
  newDigestShort?: string;
  newMajor?: number;
  newMinor?: number;
  newValue: string;
  newVersion?: string;
  semanticCommitType?: string;
  toVersion?: string;
  updateType: string;
}
