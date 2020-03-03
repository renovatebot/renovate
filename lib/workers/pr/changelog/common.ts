export interface ChangeLogNotes {
  body?: string;
  id?: number;
  name?: string;
  tag?: string;
  url: string;
}

export interface ChangeLogChange {
  date: Date;
  message: string;
  sha: string;
}

export interface ChangeLogRelease {
  changes: ChangeLogChange[];
  compare: { url?: string };
  date: string | Date;
  releaseNotes?: ChangeLogNotes;
  version: string;
}

export interface ChangeLogProject {
  depName?: string;
  github: string;
  githubApiBaseURL?: string;
  githubBaseURL: string;
  repository: string;
}

export enum ChangeLogError {
  MissingGithubToken = 1,
}

export interface ChangeLogResult {
  hasReleaseNotes?: boolean;
  project?: ChangeLogProject;
  versions?: ChangeLogRelease[];
  error?: ChangeLogError;
}
