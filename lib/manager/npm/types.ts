export type PackageJsonType = 'app' | 'library';

export interface NpmManagerData {
  hasYarnWorkspaces?: boolean;
  packageJsonName?: string;
  packageJsonType?: PackageJsonType;
  yarnWorkspacesPackages?: string[] | string;
}
