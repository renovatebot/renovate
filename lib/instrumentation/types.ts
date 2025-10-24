import type { Attributes, SpanKind, SpanOptions } from '@opentelemetry/api';
import type { BunyanRecord } from '../logger/types';
import type { PackageFile } from '../modules/manager/types';
import type { BranchCache } from '../util/cache/repository/types';

export type RenovateSpanOptions = {
  attributes?: RenovateSpanAttributes;
} & SpanOptions;

export type RenovateSpanAttributes = {
  [ATTR_RENOVATE_SPLIT]?: RenovateSplit;
} & Attributes;

/**
 * The instrumentation decorator parameters.
 */
export interface SpanParameters {
  /**
   * The name of the span
   */
  name: string;

  /**
   * Attributes which should be added to the span
   */
  attributes?: Attributes | undefined;

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

export declare const ATTR_RENOVATE_SPLIT: 'renovate.split';
export type RenovateSplit =
  | 'init'
  | 'onboarding'
  | 'extract'
  | 'lookup'
  | 'update';
