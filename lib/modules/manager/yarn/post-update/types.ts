import type { FileChange } from '../../../../util/git/types';
import type { PackageFile } from '../../types';
import type { NpmManagerData } from '../types';

export interface DetermineLockFileDirsResult {
  yarnLockDirs: string[];
}

export interface AdditionalPackageFiles {
  npm?: Partial<PackageFile<NpmManagerData>>[];
}

export interface ArtifactError {
  lockFile: string;
  stderr?: string;
}

export interface WriteExistingFilesResult {
  artifactErrors: ArtifactError[];
  updatedArtifacts: FileChange[];
}

export interface GenerateLockFileResult {
  error?: boolean;
  lockFile?: string | null;
  stderr?: string;
  stdout?: string;
}

export interface YarnRcYmlFile {
  yarnPath?: string | null;
}
