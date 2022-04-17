import type { RepoCache, RepoCacheData } from '../types';

export class MemoryRepoCache implements RepoCache {
  private data: RepoCacheData = {};

  load(): Promise<void> {
    return Promise.resolve();
  }

  save(): Promise<void> {
    return Promise.resolve();
  }

  getData(): RepoCacheData {
    this.data ??= {};
    return this.data;
  }
}
