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
  gitRef: string;
  tagPrefix?: string;
}

export interface ChangeLogProject {
  depName?: string;
  type: 'github' | 'gitlab' | 'azure';
  apiBaseUrl?: string;
  baseUrl: string;
  repository: string;
  sourceUrl: string;
  sourceDirectory?: string;
  tagPrefix?: string;
}

export type ChangeLogError = 'MissingGithubToken' | 'MissingGitlabToken' | 'MissingAzureToken';

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
