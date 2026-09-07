import { GiteaHttp } from '../../../../../../util/http/gitea.ts';
import type {
  ChangeLogFile,
  ChangeLogNotes,
  ChangeLogProject,
  ChangeLogRelease,
} from '../types.ts';
import * as common from './common.ts';

export const id = 'gitea-changelog';
const http = new GiteaHttp(id);

export function getReleaseNotesMd(
  repository: string,
  apiBaseUrl: string,
  sourceDirectory?: string,
): Promise<ChangeLogFile | null> {
  return common.getReleaseNotesMd(
    http,
    repository,
    apiBaseUrl,
    sourceDirectory,
  );
}

export function getReleaseList(
  project: ChangeLogProject,
  release: ChangeLogRelease,
): Promise<ChangeLogNotes[]> {
  return common.getReleaseList(http, project, release);
}
