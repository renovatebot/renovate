import type { BranchUpgradeConfig } from '../../../../types';

export abstract class ChangeLogContentSource {
  constructor(public readonly platform: ChangeLogPlatform) {}

  abstract getReleaseList(
    project: ChangeLogProject,
    _release: ChangeLogRelease
  ): Promise<ChangeLogNotes[]>;

  abstract getChangeLogFile(
    repository: string,
    apiBaseUrl: string,
    sourceDirectory?: string
  ): Promise<ChangeLogFile | null>;
}

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
}

export type ChangeLogPlatform = 'bitbucket' | 'gitea' | 'github' | 'gitlab';

export interface ChangeLogConfig extends BranchUpgradeConfig {
  source: ChangeLogContentSource;
}

export interface ChangeLogProject {
  packageName?: string;
  apiBaseUrl: string;
  baseUrl: string;
  repository: string;
  sourceUrl: string;
  sourceDirectory?: string;
}

export type ChangeLogError =
  | 'MissingBitbucketToken'
  | 'MissingGithubToken'
  | 'MissingGitlabToken';

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
