export interface DataSource {
  datasource: string;
  registryUrl: string;
  packageName: string;
}

export interface VersionInfo {
  Version: string;
  Time?: string;
}
