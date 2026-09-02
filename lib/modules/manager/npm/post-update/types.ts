import type { DateTime } from 'luxon';
import type { FileChange } from '../../../../util/git/types.ts';
import type {
  ArtifactError,
  ArtifactNotice,
  PackageFile,
} from '../../types.ts';
import type { NpmManagerData } from '../types.ts';
import type { lazyLoadPackageJson } from './utils.ts';

export interface DetermineLockFileDirsResult {
  yarnLockDirs: string[];
  npmLockDirs: string[];
  pnpmLockFileDirs: string[];
}

export interface AdditionalPackageFiles {
  npm?: Partial<PackageFile<NpmManagerData>>[];
}

export interface WriteExistingFilesResult {
  artifactErrors: ArtifactError[];
  artifactNotices?: ArtifactNotice[];
  updatedArtifacts: FileChange[];
}

export interface GenerateLockFileResult {
  error?: boolean;
  lockFile?: string | null;
  stderr?: string;
  stdout?: string;
  beforeFallback?: boolean;
}

// the dependencies schema is different for v6 and other lockfile versions
// Ref: https://github.com/pnpm/spec/issues/4#issuecomment-1524059392
export type PnpmDependency = Record<string, { version: string } | string>;

export interface PnpmLockFile {
  lockfileVersion: number | string;
  catalogs?: Record<string, Record<string, { version: string }>>;
  importers?: Record<string, Record<string, PnpmDependency>>;
  dependencies: PnpmDependency;
  devDependencies: PnpmDependency;
  optionalDependencies: PnpmDependency;
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

export interface HostRulesResult {
  additionalNpmrcContent: string[];
  additionalYarnRcYml?: any;
}

export interface NpmrcCooldownResult {
  date: DateTime<true>;
  source: 'before' | 'min-release-age';
}

export type LazyPackageJson = ReturnType<typeof lazyLoadPackageJson>;
