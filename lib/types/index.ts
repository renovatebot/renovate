export type { ModuleApi, RenovatePackageJson } from './base.ts';
export type { BranchStatus } from './branch-status.ts';
export type { CommitMessageJSON } from './commit-message-json.ts';
export type { CombinedHostRule, HostRule } from './host-rules.ts';
export type { PrState } from './pr-state.ts';
export type { SkipReason, StageName } from './skip-reason.ts';
export type { RangeStrategy } from './versioning.ts';
export type {
  SecurityAdvisory,
  SecurityVulnerability,
  VulnerabilityAlert,
  VulnerabilityPackage,
} from './vulnerability-alert.ts';

export type AutoMergeType = 'branch' | 'pr' | 'pr-comment';

type Val = NonNullable<unknown>;

/**
 * A type that can be null or undefined.
 *
 * @see https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#nullish-coalescing
 */
export type Nullish<T extends Val> = T | null | undefined;

export type MaybePromise<T> = T | Promise<T>;
