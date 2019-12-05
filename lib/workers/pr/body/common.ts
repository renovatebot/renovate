import { LookupUpdate } from '../../repository/process/lookup/common';
import { RenovateSharedConfig } from '../../../config';
import { Release, ReleaseResult } from '../../../datasource';

// TODO: Unify and optimize types and interfaces
export type PrBodyConfig = {
  upgrades: (LookupUpdate &
    Release &
    ReleaseResult & {
      prBodyNotes?: string[];
      depName?: string;
      depNameLinked?: string;
      references?: string;
      versionScheme: string;
    })[];
  prBanner?: string;
  prBodyTemplate: string;
  prBodyColumns: string[];
  prBodyDefinitions: Record<string, string>;
  updateType: string;
  isGroup?: boolean;
  isPin?: boolean;
  hasReleaseNotes?: boolean;
  global?: { prBanner?: string; prFooter?: string };
} & Partial<RenovateSharedConfig>;
