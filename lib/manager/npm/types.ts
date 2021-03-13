export type LernaClient = 'yarn' | 'npm';
export type PackageJsonType = 'app' | 'library';

export interface NpmManagerData {
  hasYarnWorkspaces?: boolean;
  lernaClient?: LernaClient;
  lernaDir?: string;
  packageJsonName?: string;
  packageJsonType?: PackageJsonType;
  yarnWorkspacesPackages?: string[] | string;
}
