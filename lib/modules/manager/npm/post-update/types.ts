import type { DateTime } from 'luxon';
import type { FileChange } from '../../../../util/git/types.ts';
import type {
  ArtifactError,
  ArtifactNotice,
  PackageFile,
  PostUpdateConfig,
  Upgrade,
} from '../../types.ts';
import type { NpmManagerData } from '../types.ts';
import type { lazyLoadPackageJson } from './utils.ts';

// The `managerData` keys under which the lock file paths are stored
export type NpmLockFileKey = 'npmLock' | 'yarnLock' | 'pnpmLockFile';

export type DetermineLockFileDirsResult = Record<NpmLockFileKey, string[]>;

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

export interface LockFileGeneratorContext {
  lockFileDir: string;
  lockFileName: string;
  env: NodeJS.ProcessEnv;
  config: PostUpdateConfig<NpmManagerData>;
  upgrades: Upgrade[];
  npmrcContent: string | null;
  updatedArtifacts: FileChange[];
  additionalYarnRcYml?: any;
}

// A single lock file generation, including the package manager specific steps
export interface LockFileGeneratorRun {
  generate(): Promise<GenerateLockFileResult>;

  // Runs after the updated lock file was added to `updatedArtifacts`
  onUpdated?(): Promise<void>;

  // Runs after a successful generation, before the .npmrc is restored
  onSuccess?(): Promise<void>;

  // Runs last, after the .npmrc was restored
  onFinish?(): Promise<void>;
}

export interface LockFileGenerator {
  lockFileKey: NpmLockFileKey;

  // Package manager name, used for logging
  type: string;

  // The result field which holds the "no matching version" output
  outputField: 'stderr' | 'stdout';

  // The message the package manager logs when a version cannot be found
  missingVersionMessage(depName: string | undefined): string;

  // The message stored in `artifactErrors` when the generation failed
  artifactErrorMessage(res: GenerateLockFileResult): string | undefined;

  // Whether the GitHub token needs to be stripped from the lock file
  redactToken?: boolean;

  // Whether an empty result means there is nothing to update
  skipEmptyLockFile?: boolean;

  start(ctx: LockFileGeneratorContext): LockFileGeneratorRun;
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
