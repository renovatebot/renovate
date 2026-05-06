export type {
  MergeStrategy,
  RenovateSplit,
  UpdateType,
  ValidationMessage,
} from '../config/types.ts';
export type { LogRecord } from '../logger/types.ts';
export type {
  BranchCache,
  BranchUpgradeCache,
} from '../util/cache/repository/types.ts';
export type {
  ProcessResult,
  ProcessStatus,
  RepositoryResult,
} from '../workers/repository/result.ts';
export type { BranchResult, PrBlockedBy } from '../workers/types.ts';
export type { ModuleApi, RenovatePackageJson } from './base.ts';
export type { BranchStatus } from './branch-status.ts';
export type { CommitMessageJSON } from './commit-message-json.ts';
export type { CombinedHostRule, HostRule } from './host-rules.ts';
export type { PrState } from './pr-state.ts';
export type { SkipReason, StageName } from './skip-reason.ts';
export type { RangeStrategy } from './versioning.ts';

export type AutoMergeType = 'branch' | 'pr' | 'pr-comment';

type Val = NonNullable<unknown>;

/**
 * A type that can be null or undefined.
 *
 * @see https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#nullish-coalescing
 */
export type Nullish<T extends Val> = T | null | undefined;

export type MaybePromise<T> = T | Promise<T>;

/**
 * The Extends utility type ensures that U is a subset of T (typically a union).
 * This helps ensure that we get a typescript error should anything ever be removed
 * from T but still remain in U.
 *
 * @example
 * type MyType = Extends<AutoMergeType, 'pr' | 'branch'>; // works
 *
 * @example
 * type IsBroken = Extends<AutoMergeType, 'pr' | 'branch' | 'oh-no' >;  // This will give a typescript error
 */
export type Extends<T, U extends T> = U;
