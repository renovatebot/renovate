import { UpdateType } from '../../../../config';

export interface LookupUpdate {
  blockedByPin?: boolean;
  branchName?: string;
  canBeUnpublished?: boolean;
  checksumUrl?: string;
  commitMessageAction?: string;
  displayFrom?: string;
  displayTo?: string;
  downloadUrl?: string;
  isBump?: boolean;
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
  releaseTimestamp?: string;
  semanticCommitType?: string;
  toVersion?: string;
  updateType: UpdateType;
}
