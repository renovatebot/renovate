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

type Val = NonNullable<unknown>;

/**
 * A type that can be null or undefined.
 *
 * @see https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#nullish-coalescing
 */
export type Nullish<T extends Val> = T | null | undefined;

export type MaybePromise<T> = T | Promise<T>;
