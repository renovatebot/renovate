import { PrBodyUpgrade, PrBodyConfig } from './pr/body/common';
import { PackageDependency } from '../manager/common';
import { ChangeLogConfig } from './pr/changelog';
import { RenovateSharedConfig } from '../config';
import { StabilityConfig, UnpublishableConfig } from './branch/status-checks';
import { CommitConfig } from './branch/commit';

export type PrUpgrade = PrBodyUpgrade &
  PackageDependency &
  ChangeLogConfig &
  PrBodyConfig & {
    manager?: string;
    hasUrls?: boolean;
    githubName?: string | undefined;
  };

export type BranchConfig = RenovateSharedConfig &
  StabilityConfig &
  UnpublishableConfig &
  CommitConfig &
  PrBodyConfig<PrUpgrade>;
