import type { FileChange } from '../../../util/git/types';
import type { PackageFile } from '../../types';

export interface DetermineLockFileDirsResult {
  yarnLockDirs: string[];
  npmLockDirs: string[];
  pnpmShrinkwrapDirs: string[];
  lernaJsonFiles: string[];
}

export interface AdditionalPackageFiles {
  npm?: Partial<PackageFile>[];
}

export interface ArtifactError {
  lockFile: string;
  stderr: string;
}

export interface WriteExistingFilesResult {
  artifactErrors: ArtifactError[];
  updatedArtifacts: FileChange[];
}

export interface GenerateLockFileResult {
  error?: boolean;
  lockFile?: string;
  stderr?: string;
  stdout?: string;
}
