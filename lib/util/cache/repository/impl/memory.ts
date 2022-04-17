import type { RepoCache, RepoCacheData } from '../types';

export class MemoryRepoCache implements RepoCache {
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
    this.data ??= {};
    return this.data;
  }
}
