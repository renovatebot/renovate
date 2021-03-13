export type PackageJsonType = 'app' | 'library';

export interface NpmManagerData {
  hasYarnWorkspaces?: boolean;
  lernaDir?: string;
  packageJsonName?: string;
  packageJsonType?: PackageJsonType;
  yarnWorkspacesPackages?: string[] | string;
}
