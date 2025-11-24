import type { AllConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { PackageCache } from './impl';

export let packageCache = new PackageCache();

export async function init(config: AllConfig): Promise<void> {
  packageCache = await PackageCache.create(config);
}

export async function cleanup(): Promise<void> {
  try {
    await packageCache.destroy();
  } catch (err) {
    logger.warn({ err }, 'Package cache cleanup failed');
  }
}
