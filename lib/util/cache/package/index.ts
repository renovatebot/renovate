import type { AllConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { PackageCache } from './impl';

export let packageCache = new PackageCache();

export async function init(config: AllConfig): Promise<void> {
  packageCache = await PackageCache.create(config);
}

/** v8 ignore next - hard to create a genuine test */
export async function destroy(): Promise<void> {
  try {
    await packageCache.destroy();
  } catch (err) {
    logger.warn({ err }, 'Package cache destroy failed');
  }
}
