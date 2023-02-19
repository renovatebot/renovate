import type { FileChange } from '../../../../util/git/types';
import type { PackageFileContent } from '../../types';
import type { NpmManagerData } from '../types';

export interface DetermineLockFileDirsResult {
  yarnLockDirs: string[];
  npmLockDirs: string[];
  pnpmShrinkwrapDirs: string[];
  lernaJsonFiles: string[];
}

export interface AdditionalPackageFiles {
  npm?: Partial<PackageFileContent<NpmManagerData>>[];
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

export interface PnpmLockFile {
  lockfileVersion?: number;
}

export interface YarnRcYmlFile {
  yarnPath?: string | null;
}
