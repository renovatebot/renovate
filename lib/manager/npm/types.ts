export type LernaClient = 'yarn' | 'npm';
export type PackageJsonType = 'app' | 'library';

export interface NpmLockFiles {
  yarnLock?: string;
  packageLock?: string;
  shrinkwrapJson?: string;
  pnpmShrinkwrap?: string;
  npmLock?: string;
}

export interface NpmManagerData extends NpmLockFiles {
  hasYarnWorkspaces?: boolean;
  isPackageAlias?: boolean;
  lernaClient?: LernaClient;
  lernaJsonFile?: string;
  lernaPackages?: string[];
  packageJsonName?: string;
  packageJsonType?: PackageJsonType;
  yarnWorkspacesPackages?: string[] | string;
}
