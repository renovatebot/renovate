export interface JenkinsPluginInfo {
  name: string;
  scm?: string;
}

export interface JenkinsPluginVersion {
  version: string;
  buildDate?: string;
  url?: string;
}

export interface JenkinsPluginsInfoResponse {
  plugins: Record<string, JenkinsPluginInfo>;
}

export interface JenkinsPluginsVersionsResponse {
  plugins: Record<string, Record<string, JenkinsPluginVersion>>;
}
