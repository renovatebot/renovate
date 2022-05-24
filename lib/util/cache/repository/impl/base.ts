import type { RepoCache, RepoCacheData } from '../types';

export class RepoCacheBase implements RepoCache {
  protected data: RepoCacheData = {};

  // istanbul ignore next
  async load(): Promise<void> {
    await Promise.resolve();
  }

  // istanbul ignore next
  async save(): Promise<void> {
    await Promise.resolve();
  }

  getData(): RepoCacheData {
    return this.data;
  }
}
