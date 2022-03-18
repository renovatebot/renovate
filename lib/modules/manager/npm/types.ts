interface LockFilePackage {
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
  bin?: string | { [index: string]: string };
  license?: string;
  engines?: { [index: string]: string };
  dependencies?: { [index: string]: string };
  optionalDependencies?: { [index: string]: string };
}

interface LockFilePackages {
  [index: string]: LockFilePackage;
}

interface LockFileDependency {
  version: string;
  integrity: string;
  resolved: string;
  bundled?: boolean;
  dev?: boolean;
  optional?: boolean;
  requires?: { [index: string]: string };
  dependencies?: LockFileDependencies;
}

interface LockFileDependencies {
  [index: string]: LockFileDependency;
}

// https://docs.npmjs.com/cli/v6/configuring-npm/package-lock-json#file-format
interface LockFile1 {
  name: string;
  version: string;
  lockfileVersion: 1;
  packageIntegrity?: string;
  preserveSymlinks?: string;
  dependencies: LockFileDependencies;
}

// https://docs.npmjs.com/cli/v7/configuring-npm/package-lock-json#file-format
// https://docs.npmjs.com/cli/v8/configuring-npm/package-lock-json#file-format
interface LockFile2 {
  name: string;
  version: string;
  lockfileVersion: 2;
  packages: LockFilePackages;
  dependencies: LockFileDependencies;
}

// currently only hinted in the npm v7 and v8 docs
interface LockFile3 {
  name: string;
  version: string;
  lockfileVersion: 3;
  packages: LockFilePackages;
}

type LockFile = LockFile1 | LockFile2 | LockFile3;

export interface ParseLockFileResult {
  detectedIndent: string;
  lockFileParsed: LockFile | undefined;
}
