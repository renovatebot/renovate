export interface BatectConfig {
  containers?: Record<string, BatectContainer>;
  include?: BatectInclude[];
}

export interface BatectContainer {
  image?: string;
}

export type BatectInclude = string | BatectFileInclude | BatectGitInclude;

export interface BatectFileInclude {
  type: 'file';
}

export interface BatectGitInclude {
  type: 'git';
  repo: string;
  ref: string;
}
