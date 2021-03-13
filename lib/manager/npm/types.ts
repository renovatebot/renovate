export type PackageJsonType = 'app' | 'library';

export interface NpmManagerData {
  packageJsonName?: string;
  packageJsonType?: PackageJsonType;
  yarnWorkspacesPackages?: string[] | string;
}
