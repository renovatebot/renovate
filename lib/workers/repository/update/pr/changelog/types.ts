export interface ChangeLogNotes {
  body?: string;
  id?: number;
  name?: string;
  tag?: string;
  // url to changelog.md file or github/gitlab release api
  notesSourceUrl: string;
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
  type: 'github' | 'gitlab';
  apiBaseUrl?: string;
  baseUrl: string;
  repository: string;
  sourceUrl: string;
  sourceDirectory?: string;
}

// eslint-disable-next-line typescript-enum/no-enum
export enum ChangeLogError {
  MissingGithubToken = 1,
  MissingGitlabToken = 2,
}

export interface ChangeLogResult {
  hasReleaseNotes?: boolean;
  project?: ChangeLogProject;
  versions?: ChangeLogRelease[];
  error?: ChangeLogError;
}

export interface ChangeLogFile {
  changelogFile: string;
  changelogMd: string;
}
