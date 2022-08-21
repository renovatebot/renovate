import type { RepoCache, RepoCacheData } from '../types';

export class RepoCacheNull implements RepoCache {
  private data: RepoCacheData = {};

  // istanbul ignore next
  load(): Promise<void> {
    return Promise.resolve();
  }

  // istanbul ignore next
  save(): Promise<void> {
    return Promise.resolve();
  }

  getData(): RepoCacheData {
    return this.data;
  }
}
