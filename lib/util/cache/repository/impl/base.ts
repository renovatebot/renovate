import type { RepoCache, RepoCacheData } from '../types';

export abstract class RepoCacheBase implements RepoCache {
  protected data: RepoCacheData = {};

  // istanbul ignore next
  async load(): Promise<void> {
    await Promise.resolve();
  }

  // istanbul ignore next
  async save(): Promise<void> {
    await Promise.resolve();
  }

  abstract getData(): RepoCacheData;
}
