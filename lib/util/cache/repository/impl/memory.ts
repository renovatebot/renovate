import type { RepoCache, RepoCacheData } from '../types';

export class MemoryRepoCache implements RepoCache {
  private data: RepoCacheData = {};

  load(): Promise<void> {
    // istanbul ignore next
    return;
  }

  save(): Promise<void> {
    // istanbul ignore next
    return;
  }

  getData(): RepoCacheData {
    this.data ??= {};
    return this.data;
  }
}
