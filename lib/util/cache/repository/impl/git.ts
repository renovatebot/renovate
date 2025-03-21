import * as repoStore from '../../../git/repo-store';
import type { RepoCacheRecord } from '../schema';
import { RepoCacheBase } from './base';

export class RepoCacheGit extends RepoCacheBase {
  constructor(repository: string, fingerprint: string) {
    super(repository, fingerprint);
  }

  protected read(): Promise<string | null> {
    return repoStore.get('cache');
  }

  protected write(data: RepoCacheRecord): Promise<void> {
    return repoStore.set('cache', JSON.stringify(data, null, 2));
  }
}
