import type { Attributes, SpanKind, SpanOptions } from '@opentelemetry/api';
import type { RenovateSplit } from '../config/types.ts';
import type { BunyanRecord } from '../logger/types.ts';
import type { PackageFile } from '../modules/manager/types.ts';
import type { BranchCache } from '../util/cache/repository/types.ts';
import type { GitOperationType } from '../util/git/types.ts';

export type RenovateSpanOptions = {
  attributes?: RenovateSpanAttributes;
} & SpanOptions;

export type RenovateSpanAttributes = {
  [ATTR_RENOVATE_SPLIT]?: RenovateSplit;
  [ATTR_VCS_GIT_OPERATION_TYPE]?: GitOperationType;
} & Attributes;

/**
 * The instrumentation parameters.
 */
export interface SpanParameters {
  /**
   * The name of the span
   */
  name: string;

  /**
   * Attributes which should be added to the span
   */
  attributes?: RenovateSpanAttributes | undefined;

  /**
   * Should this span be added to the root span or to the current active span
   */
  ignoreParentSpan?: boolean;

  /**
   * Type of span this represents. Default: SpanKind.Internal
   */
  kind?: SpanKind;
}

export interface Report {
  problems: BunyanRecord[];
  repositories: Record<string, RepoReport>;
}

interface RepoReport {
  problems: BunyanRecord[];
  branches: Partial<BranchCache>[];
  packageFiles: Record<string, PackageFile[]>;
  libYearsWithStatus?: LibYearsWithStatus;
}

export interface LibYearsWithStatus {
  libYears: LibYears;
  dependencyStatus: DependencyStatus;
}

export interface LibYears {
  total: number;
  managers: Record<string, number>;
}

export interface DependencyStatus {
  outdated: number;
  total: number;
}

export const ATTR_RENOVATE_SPLIT = 'renovate.split';

/**
 * the Git Version Control System (VCS)'s Operation Type
 *
 * @see GitOperationType
 * @see https://opentelemetry.io/docs/specs/semconv/registry/attributes/vcs/
 *
 */
export const ATTR_VCS_GIT_OPERATION_TYPE = 'vcs.git.operation.type';

/**
 * the Git Version Control System (VCS)'s subcommand
 *
 * @see https://opentelemetry.io/docs/specs/semconv/registry/attributes/vcs/
 * */
export const ATTR_VCS_GIT_SUBCOMMAND = 'vcs.git.subcommand';
