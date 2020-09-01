import { RenovateConfig } from '../../../config';
import * as memCache from '../../../util/cache/memory';
import * as repositoryCache from '../../../util/cache/repository';

export async function initializeCaches(config: RenovateConfig): Promise<void> {
  memCache.init();
  await repositoryCache.initialize(config);
}
