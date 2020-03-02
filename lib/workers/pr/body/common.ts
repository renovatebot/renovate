import { LookupUpdate } from '../../repository/process/lookup/common';
import { Release, ReleaseResult } from '../../../datasource';
import { BranchConfig } from '../../common';

export type PrBodyUpgrade = LookupUpdate &
  Release &
  ReleaseResult & {
    prBodyNotes?: string[];
    depName?: string;
    depNameLinked?: string;
    references?: string;
    versioning: string;
    stabilityDays?: number;
  };

// TODO: Unify and optimize types and interfaces
export type PrBodyConfig = BranchConfig;

// = {
//   upgrades: T[];
//   prBanner?: string;
//   prBodyTemplate: string;
//   prBodyColumns: string[];
//   prBodyDefinitions: Record<string, string>;
//   prTitle?: string;
//   updateType: UpdateType;
//   isGroup?: boolean;
//   isPin?: boolean;
//   hasReleaseNotes?: boolean;
//   global?: GlobalConfig;
// } & Partial<RenovateSharedConfig>;
