import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { isFunction } from '@sindresorhus/is';
import { dequal } from 'dequal';
import upath from 'upath';
import { massageConfig } from '../../../../config/massage.ts';
import { migrateConfig } from '../../../../config/migration.ts';
import type { RenovateConfig } from '../../../../config/types.ts';
import { validateConfig } from '../../../../config/validation.ts';
import { logger } from '../../../../logger/index.ts';
import { parseJson } from '../../../../util/common.ts';
import { readSystemFile } from '../../../../util/fs/index.ts';
import { parseSingleYaml } from '../../../../util/yaml.ts';

export async function migrateAndValidateConfig(
  config: RenovateConfig,
  configType: string,
): Promise<RenovateConfig> {
  const { isMigrated, migratedConfig } = migrateConfig(config);
  if (isMigrated) {
    logger.warn(
      { configType, originalConfig: config, migratedConfig },
      'Config needs migrating',
    );
  }
  const massagedConfig = massageConfig(migratedConfig);
  // log only if it's changed
  if (!dequal(migratedConfig, massagedConfig)) {
    logger.trace({ config: massagedConfig }, 'Post-massage config');
  }

  const { warnings, errors } = await validateConfig('global', massagedConfig);

  if (warnings.length) {
    logger.warn({ configType, warnings }, 'Config validation warnings found');
  }
  if (errors.length) {
    logger.warn({ configType, errors }, 'Config validation errors found');
  }

  return massagedConfig;
}

export async function getParsedContent(file: string): Promise<RenovateConfig> {
  if (upath.basename(file) === '.renovaterc') {
    return parseJson(
      await readSystemFile(file, 'utf8'),
      file,
    ) as RenovateConfig;
  }
  switch (upath.extname(file)) {
    case '.yaml':
    case '.yml':
      return parseSingleYaml(await readSystemFile(file, 'utf8'));
    case '.json5':
    case '.json':
      return parseJson(
        await readSystemFile(file, 'utf8'),
        file,
      ) as RenovateConfig;
    case '.cjs':
    case '.mjs':
    case '.js': {
      const absoluteFilePath = upath.isAbsolute(file)
        ? file
        : `${process.cwd()}/${file}`;
      const fileUrl = pathToFileURL(absoluteFilePath).href;

      let tmpConfig: unknown;
      try {
        // Try ESM import first (default for "type": "module")
        tmpConfig = await import(fileUrl);
      } catch (err) {
        /* v8 ignore start -- CJS fallback not testable in vitest */

        // If the file is .js, it might be a legacy CJS config (using module.exports)
        // This usually throws ReferenceError (module is not defined) or SyntaxError
        if (upath.extname(file) === '.js') {
          const require = createRequire(import.meta.url);
          try {
            tmpConfig = require(absoluteFilePath);
          } catch {
            // If require also fails (e.g. strict ESM package), throw the original import error
            // to encourage the user to fix their config format.
            throw err;
          }
        } else {
          throw err;
        }
        /* v8 ignore stop */
      }

      /* v8 ignore next -- not testable */
      let config =
        (tmpConfig as { default?: RenovateConfig }).default ?? tmpConfig;
      // Allow the config to be a function
      if (isFunction(config)) {
        config = config();
      }
      return config as RenovateConfig;
    }
    default:
      throw new Error('Unsupported file type');
  }
}
