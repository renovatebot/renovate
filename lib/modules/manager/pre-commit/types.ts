export interface PreCommitConfig {
  repos: PreCommitDependency[];
}

export interface PreCommitHook {
  language?: string;
  additional_dependencies?: string[];
}

export interface PreCommitDependency {
  repo: string;
  hooks?: PreCommitHook[];
  rev: string;
}
