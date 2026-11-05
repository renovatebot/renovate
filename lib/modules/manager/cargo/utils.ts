import { logger } from '../../../logger/index.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import { CargoConfig } from './schema.ts';

/**
 * A sentinel value to signal the Default Registry (crates-io)
 */
export const DEFAULT_REGISTRY_URL = Symbol('DEFAULT_REGISTRY_URL');

/** The name of crates.io in the cargo config */
export const DEFAULT_REGISTRY_ID = 'crates-io';

/** Reads `.cargo/config`, or, if not found, `.cargo/config.toml`, as cargo uses `.cargo/config` if both exist */
export async function readCargoConfig(): Promise<CargoConfig | null> {
  for (const configName of ['config', 'config.toml']) {
    const path = `.cargo/${configName}`;
    const payload = await readLocalFile(path, 'utf8');
    if (payload) {
      const parsedCargoConfig = CargoConfig.safeParse(payload);
      if (parsedCargoConfig.success) {
        return parsedCargoConfig.data;
      }
      logger.debug(
        { err: parsedCargoConfig.error, path },
        `Error parsing cargo config`,
      );
    }
  }

  logger.debug('Neither .cargo/config nor .cargo/config.toml found');
  return null;
}
