export interface HelmsmanDocument {
  helmRepos: Record<string, string>;
  apps: Record<string, HelmsmanApp>;
}

export interface HelmsmanApp {
  version?: string;
  chart?: string;
}
