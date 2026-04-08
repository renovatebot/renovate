import type { PackageRule, RenovateConfig } from '../../config/types.ts';
import type { ModuleApi } from '../../types/base.ts';
import type { BranchStatus, UpdateType } from '../../types/index.ts';
import type { SkipReason } from '../../types/skip-reason.ts';
import type { MergeConfidence } from '../../util/merge-confidence/types.ts';
import type { PackageFile } from '../manager/types.ts';

export interface EnrichmentDependencyContext {
  datasource: string;
  packageName: string;
  currentVersion?: string;
  packageFile?: string;
  manager?: string;
}

export interface EnrichmentUpdateContext extends EnrichmentDependencyContext {
  newVersion: string;
  updateType?: UpdateType;
}

/**
 * Result from a repository-scoped enrichment.
 * Only packageRules are applicable at this scope — prBodyNotes, statusChecks,
 * skipReason etc. are per-update concepts and belong in enrichUpdate().
 */
export type EnrichmentRepositoryResult = Pick<EnrichmentResult, 'packageRules'>;

export interface EnrichmentResult {
  /** PackageRules to inject (for vulnerability alerts, etc.)
   *
   * Will append to the existing value, if any.
   */
  packageRules?: PackageRule[];
  /** PR body notes to append.
   *
   * Will append to the existing value, if any.
   */
  prBodyNotes?: string[];

  /**
   * Whether this dependency should be not updated, for a given reason
   *
   * Will override the `skipReason` already on the dependency.
   * */
  skipReason?: SkipReason;
  /** Links providing context for the skip */
  skipReferences?: string[];

  /** Merge confidence level for this update
   *
   * Will override the existing value, if any.
   */
  mergeConfidenceLevel?: MergeConfidence;

  /** Arbitrary metadata available for matchJsonata. Renovate does not interpret these values. */
  metadata?: Record<string, unknown>;

  /** Status check to set on branches */
  statusCheck?: {
    // TODO multiple
    context: string; // TODO doc statusCheckNames
    status: BranchStatus;
    description: string;
    url?: string;
  };
}

/** Describes a metadata field that an enrichment module produces */
export interface EnrichmentMetadataField {
  /** The key name in EnrichmentResult.metadata */
  key: string;
  /** Human-readable description of what this field represents */
  description: string;
  /** The TypeScript/JSON type of the value */
  type: 'string' | 'number' | 'boolean' | 'object';
  /** Example value for documentation */
  example?: unknown;
}

/** Describes what an enrichment module can produce */
export interface EnrichmentCapabilities {
  /** Whether this module can produce packageRules */
  producesPackageRules?: boolean;
  /** Whether this module can produce prBodyNotes */
  producesPrBodyNotes?: boolean;
  /** Whether this module can produce statusChecks */
  producesStatusChecks?: boolean;
  /** Whether this module can produce skipReasons */
  producesSkipReasons?: boolean;
  /** Metadata fields this module produces (available for matchJsonata) */
  metadataFields?: readonly EnrichmentMetadataField[];
}

/**
 * Enrichment allows adding additional metadata to Renovate's discovered packages (and their updates), and allows more control over whether updates should be skipped, blocked or have additional metadata that can be used with `matchJsonata`.
 */
export interface EnrichmentApi extends ModuleApi {
  readonly id: string;
  supportedDatasources?: string[];

  /** Self-documenting declaration of what this enrichment produces */
  readonly capabilities: EnrichmentCapabilities;

  /** Global initialization, called once at global worker start */
  init?(config: RenovateConfig): Promise<void>;
  /** Per-repo initialization, called once per repository */
  initRepo?(config: RenovateConfig): Promise<void>;

  /** Whether this enrichment is enabled for the current config */
  isEnabled(config: RenovateConfig): boolean;

  /** Runs once with all package files (e.g. vulnerability alerts) */
  enrichRepository?(
    config: RenovateConfig,
    packageFiles: Record<string, PackageFile[]>,
  ): Promise<EnrichmentRepositoryResult>;

  /** Runs per dependency (e.g. OpenSSF Scorecard by sourceUrl) */
  enrichDependency?(
    context: EnrichmentDependencyContext,
    config: RenovateConfig,
  ): Promise<EnrichmentResult | null>;

  /** Runs per update candidate (e.g. merge confidence) */
  enrichUpdate?(
    context: EnrichmentUpdateContext,
    config: RenovateConfig,
  ): Promise<EnrichmentResult | null>;

  /** Optional cleanup */
  cleanup?(): Promise<void>;
}
