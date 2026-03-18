import { logger } from '../../../../../../logger/index.ts';
import { UnityReleasesJSON } from '../../../../../../modules/datasource/unity3d/schema.ts';
import { Http } from '../../../../../../util/http/index.ts';
import type {
  ChangeLogFile,
  ChangeLogNotes,
  ChangeLogProject,
  ChangeLogRelease,
} from '../types.ts';

export const id = 'generic-changelog';
const http = new Http(id);

export async function getReleaseNotesMd(
  releaseNotesUrl: string,
  depName?: string,
): Promise<ChangeLogFile | null> {
  logger.trace('generic.getReleaseNotesMd()');

  if (depName === 'Unity Editor') {
    return null;
  }

  const releaseNotesRes = await http.getText(releaseNotesUrl);

  if (!releaseNotesRes.body) {
    logger.debug(`Missing content for changelog file`);
    return null;
  }

  const changelogMd = releaseNotesRes.body;

  return { changelogFile: '', changelogMd };
}

export async function getReleaseList(
  project: ChangeLogProject,
  _release: ChangeLogRelease,
): Promise<ChangeLogNotes[]> {
  logger.trace('generic.getReleaseList()');

  const changelogNotes: ChangeLogNotes[] = [];

  if (
    project.depName === 'Unity Editor' &&
    project.packageName === 'm_EditorVersion'
  ) {
    const response = await http.getJson(
      `https://services.api.unity.com/unity/editor/release/v1/releases?version=${_release.version}`,
      UnityReleasesJSON,
    );

    const release = response.body.results[0];

    const changelogFile = await getReleaseNotesMd(release.releaseNotes.url);

    changelogNotes.push({
      url: release.releaseNotes.url,
      notesSourceUrl: release.releaseNotes.url,
      body: changelogFile!.changelogMd,
      tag: _release.version,
    });
  }

  return changelogNotes;
}
