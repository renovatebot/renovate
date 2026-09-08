import type { z } from 'zod/v4';
import type { FileChange } from '../../../util/git/types.ts';
import type { ArtifactError, PackageDependency } from '../types.ts';
import type { ActionsLockfile } from './schema.ts';

/** Mirrors the shape `processBranch` already concatenates onto its config for lock file updates. */
export interface ActionsLockfileResult {
  updatedArtifacts: FileChange[];
  artifactErrors: ArtifactError[];
}

/** The workflows which `gh actions-lock` has onboarded, keyed by their path. */
export type OnboardedWorkflows = ActionsLockfile['workflows'];

/** The repository's `actions.lock`, as far as we can make sense of it. */
export type LockfileState =
  | { type: 'missing' }
  | { type: 'unparseable' }
  | { type: 'parsed'; onboardedWorkflows: OnboardedWorkflows };

/**
 * Docker container:
 * - `docker://image:tag`
 * - `docker://image@digest`
 * - `docker://image:tag@digest`
 */
export interface DockerReference {
  kind: 'docker';
  image: string;
  tag?: string;
  digest?: string;
  originalRef: string;
}

/**
 * Local file or directory:
 * - `./path/to/action`
 * - `./.github/workflows/main.yml`
 */
export interface LocalReference {
  kind: 'local';
  path: string;
}

/**
 * Repository:
 * - `owner/repo[/path]@ref`
 * - `https://host/owner/repo[/path]@ref`
 */
export interface RepositoryReference {
  kind: 'repository';

  hostname: string;
  isExplicitHostname: boolean;

  owner: string;
  repo: string;
  path?: string;

  ref: string;
}

export type ActionReference =
  | DockerReference
  | LocalReference
  | RepositoryReference;

export interface CommentData {
  pinnedVersion?: string;
  ref?: string;
  ratchetExclude?: boolean;
  matchedString?: string;
  index?: number;
}

export interface ParsedUsesLine {
  /** The whitespace before "uses:" */
  indentation: string;

  /** The `uses:` (and optional `-`) part */
  usesPrefix: string;

  /** The raw value part, potentially quoted (e.g. `actions/checkout@v2`) */
  replaceString: string;

  /** Whitespace between value and `#` */
  commentPrecedingWhitespace: string;

  /** The full comment including `#` */
  commentString: string;

  actionRef: ActionReference | null;
  commentData: CommentData;

  /** The quote char used (' or " or empty) */
  quote: string;
}

/**
 * Parses a step - or just its `with:` block - into the dependencies it
 * declares. Most actions declare a single one, but a step may yield several.
 */
export type ActionSchema = z.ZodType<PackageDependency[]>;

export interface CommunityActionConfig {
  datasource: string;
  depName?: string;
  packageName: string;
  versioning?: string;
  extractVersion?: string;

  /**
   * Parses the `with:` block, defaulting to the `version:` input.
   *
   * The fields above are applied to every dependency it yields, so a schema
   * which yields dependencies of more than one kind must set them itself.
   */
  withSchema?: ActionSchema;
}
