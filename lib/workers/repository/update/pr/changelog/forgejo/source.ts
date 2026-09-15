import { ForgejoHttp } from '../../../../../../util/http/forgejo.ts';
import { GiteaChangeLogSource } from '../gitea/source.ts';

export const id = 'forgejo-changelog';

/**
 * Forgejo is a fork of Gitea and shares its URL layout and API, so only the
 * platform and datasource ids and the Http client differ.
 */
export class ForgejoChangeLogSource extends GiteaChangeLogSource {
  protected override readonly http = new ForgejoHttp(id);

  constructor() {
    super('forgejo', 'forgejo-tags');
  }
}
