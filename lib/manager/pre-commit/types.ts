export interface PreCommitConfig {
  repos: PreCommitDependency[];
}

export interface PreCommitDependency {
  repo: string;
  rev: string;
}
