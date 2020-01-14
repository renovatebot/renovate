import { LookupUpdate } from '../../repository/process/lookup/common';
import { RenovateSharedConfig } from '../../../config';
import { Release, ReleaseResult } from '../../../datasource';

export type PrBodyUpgrade = LookupUpdate &
  Release &
  ReleaseResult & {
    prBodyNotes?: string[];
    depName?: string;
    depNameLinked?: string;
    references?: string;
    versionScheme: string;
    stabilityDays?: number;
  };

// TODO: Unify and optimize types and interfaces
export type PrBodyConfig<T extends PrBodyUpgrade = PrBodyUpgrade> = {
  upgrades: T[];
  prBanner?: string;
  prBodyTemplate: string;
  prBodyColumns: string[];
  prBodyDefinitions: Record<string, string>;
  prTitle?: string;
  updateType: string;
  isGroup?: boolean;
  isPin?: boolean;
  hasReleaseNotes?: boolean;
  global?: { prBanner?: string; prFooter?: string };
} & Partial<RenovateSharedConfig>;
