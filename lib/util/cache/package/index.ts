import type { AllConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { PackageCache } from './impl';

export let packageCache = new PackageCache();

/* v8 ignore start -- nothing to test */
export async function init(config: AllConfig): Promise<void> {
  packageCache = await PackageCache.create(config);
} /* v8 ignore stop */

/* v8 ignore start -- almost nothing to test */
export async function cleanup(): Promise<void> {
  try {
    await packageCache.destroy();
  } catch (err) {
    logger.warn({ err }, 'Package cache cleanup failed');
  }
} /* v8 ignore stop */
