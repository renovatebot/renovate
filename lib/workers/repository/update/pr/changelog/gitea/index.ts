import { GiteaHttp } from '../../../../../../util/http/gitea.ts';
import { createChangelogApi } from './common.ts';

export const id = 'gitea-changelog';

export const { getReleaseNotesMd, getReleaseList } = createChangelogApi(
  id,
  new GiteaHttp(id),
);
