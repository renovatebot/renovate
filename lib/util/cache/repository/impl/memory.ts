import type { RepoCacheData } from '../types';
import { RepoCacheBase } from './base';

export class MemoryRepoCache extends RepoCacheBase {
  getData(): RepoCacheData {
    this.data ??= {};
    return this.data;
  }
}
