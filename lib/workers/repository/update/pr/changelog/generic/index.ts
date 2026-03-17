import type { ChangeLogFile } from '../types.ts';
import { Http } from '../../../../../../util/http/index.ts';
import { logger } from '../../../../../../logger/index.ts';

export const id = 'generic-changelog';
const http = new Http(id);

export async function getReleaseNotesMd(
  releaseNotesUrl: string,
): Promise<ChangeLogFile | null> {
  logger.trace('generic.getReleaseNotesMd()');

  const releaseNotesRes = await http.getText(releaseNotesUrl);

  if (!releaseNotesRes.body) {
    logger.debug(`Missing content for changelog file`);
    return null;
  }

  const changelogMd = releaseNotesRes.body;

  return { changelogFile: '', changelogMd };
}
