export interface PreCommitConfig {
  repos: PreCommitDependency[];
}

export interface PreCommitHook {
  language?: string;
  additional_dependencies?: string[];
}

export interface HookAdditionalDependencies {
  additional_dependencies?: string[];
  language?: string;
}

export interface PreCommitDependency {
  repo: string;
  hooks?: PreCommitHook[];
  rev: string;
}
