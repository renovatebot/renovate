export interface PreCommitConfig {
  repos: PreCommitDependency[];
}

export interface PreCommitHook {
  language?: string;
  additional_dependencies?: Array<string>;
}

export interface PreCommitDependency {
  repo: string;
  hooks?: Array<PreCommitHook>;
  rev: string;
}
