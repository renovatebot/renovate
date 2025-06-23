export type { CommitMessageJSON } from './commit-message-json';
export type { HostRule, CombinedHostRule } from './host-rules';
export type { SkipReason, StageName } from './skip-reason';
export type { RangeStrategy } from './versioning';
export type { BranchStatus } from './branch-status';
export type {
  VulnerabilityPackage,
  SecurityVulnerability,
  SecurityAdvisory,
  VulnerabilityAlert,
} from './vulnerability-alert';
export type { PrState } from './pr-state';
export type { ModuleApi, RenovatePackageJson } from './base';

export type AutoMergeType = 'branch' | 'pr' | 'pr-comment';
