export interface DataSource {
  datasource: string;
  registryUrl: string;
  packageName: string;
  repoRoot: string;
}

export interface VersionInfo {
  Version: string;
  Time?: string;
}
