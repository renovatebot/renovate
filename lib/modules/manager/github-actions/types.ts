import type { FileChange } from '../../../util/git/types.ts';
import type { ArtifactError } from '../types.ts';
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
