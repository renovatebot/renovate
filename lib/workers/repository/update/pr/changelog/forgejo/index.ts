import { ForgejoHttp } from '../../../../../../util/http/forgejo.ts';
import * as common from '../gitea/common.ts';
import type {
  ChangeLogFile,
  ChangeLogNotes,
  ChangeLogProject,
  ChangeLogRelease,
} from '../types.ts';

export const id = 'forgejo-changelog';
const http = new ForgejoHttp(id);

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
