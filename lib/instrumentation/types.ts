import type { Attributes, SpanKind } from '@opentelemetry/api';
import type { BunyanRecord } from '../logger/types';
import type { PackageFile } from '../modules/manager/types';
import type { BranchCache } from '../util/cache/repository/types';

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
}
