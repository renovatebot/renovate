import { ForgejoHttp } from '../../../../../../util/http/forgejo.ts';
import { createChangelogApi } from '../gitea/common.ts';

export const id = 'forgejo-changelog';

export const { getReleaseNotesMd, getReleaseList } = createChangelogApi(
  id,
  new ForgejoHttp(id),
);
