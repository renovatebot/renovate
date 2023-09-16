interface LockFilePackage {
  name?: string;
  version?: string;
  resolved?: string;
  integrity?: string;
  link?: boolean;
  dev?: boolean;
  optional?: boolean;
  devOptional?: boolean;
  inBundle?: boolean;
  hasInstallScript?: boolean;
  hasShrinkwrap?: boolean;
  bin?: string | Record<string, string>;
  license?: string;
  engines?: Record<string, string>;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

interface LockFileDependency {
  version: string;
  integrity: string;
  resolved: string;
  bundled?: boolean;
  dev?: boolean;
  optional?: boolean;
  requires?: Record<string, string>;
  dependencies?: Record<string, LockFileDependency>;
}

interface LockFileBase {
  name?: string;
  version?: string;
  requires?: boolean; // not documented
}

// https://docs.npmjs.com/cli/v6/configuring-npm/package-lock-json#file-format
interface LockFile1 extends LockFileBase {
  lockfileVersion: 1;
  packageIntegrity?: string;
  preserveSymlinks?: string;
  dependencies?: Record<string, LockFileDependency>;
}

// https://docs.npmjs.com/cli/v7/configuring-npm/package-lock-json#file-format
// https://docs.npmjs.com/cli/v8/configuring-npm/package-lock-json#file-format
interface LockFile2 extends LockFileBase {
  lockfileVersion: 2;
  packages: Record<string, LockFilePackage>;
  dependencies?: Record<string, LockFileDependency>;
}

// currently only hinted in the npm v7 and v8 docs
interface LockFile3 extends LockFileBase {
  lockfileVersion: 3;
  packages: Record<string, LockFilePackage>;
}

export type LockFile = LockFile1 | LockFile2 | LockFile3;

export interface ParseLockFileResult {
  detectedIndent: string;
  lockFileParsed: LockFile | undefined;
}

export type NpmDepType =
  | 'dependencies'
  | 'devDependencies'
  | 'optionalDependencies'
  | 'overrides'
  | 'peerDependencies'
  | 'resolutions';

export interface NpmLockFiles {
  yarnLock?: string;
  packageLock?: string;
  shrinkwrapJson?: string;
  pnpmShrinkwrap?: string;
  npmLock?: string;
}

export interface NpmManagerData extends NpmLockFiles, Record<string, any> {
  hasPackageManager?: boolean;
  lernaClient?: string;
  lernaJsonFile?: string;
  lernaPackages?: string[];
  packageJsonName?: string;
  parents?: string[];
  yarnZeroInstall?: boolean;
  workspacesPackages?: string[] | string;
}
