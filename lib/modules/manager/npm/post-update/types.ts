import type { FileChange } from '../../../../util/git/types';
import type { PackageFile } from '../../types';
import type { NpmManagerData } from '../types';

export interface DetermineLockFileDirsResult {
  yarnLockDirs: string[];
  npmLockDirs: string[];
  pnpmShrinkwrapDirs: string[];
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

// the dependencies schema is different for v6 and other lockfile versions
// Ref: https://github.com/pnpm/spec/issues/4#issuecomment-1524059392
export type PnpmDependencySchema = Record<string, { version: string } | string>;

export interface PnpmLockFile {
  lockfileVersion: number | string;
  catalogs?: Record<string, Record<string, { version: string }>>;
  importers?: Record<string, Record<string, PnpmDependencySchema>>;
  dependencies: PnpmDependencySchema;
  devDependencies: PnpmDependencySchema;
  optionalDependencies: PnpmDependencySchema;
}

export interface YarnRcNpmRegistry {
  npmAlwaysAuth?: boolean;
  npmAuthIdent?: string;
  npmAuthToken?: string;
}

export interface YarnRcYmlFile {
  yarnPath?: string | null;
  npmRegistries: Record<string, YarnRcNpmRegistry>;
}
