import { GiteaChangeLogSource } from '../gitea/source.ts';

/**
 * Forgejo is a fork of Gitea and shares its URL layout, so only the platform
 * and datasource ids differ.
 */
export class ForgejoChangeLogSource extends GiteaChangeLogSource {
  constructor() {
    super('forgejo', 'forgejo-tags');
  }
}
