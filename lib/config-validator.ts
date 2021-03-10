#!/usr/bin/env node
// istanbul ignore file
import { dequal } from 'dequal';
import { readFileSync } from 'fs-extra';
import JSON5 from 'json5';
import { configFileNames } from './config/app-strings';
import { getConfig as getFileConfig } from './config/file';
import { massageConfig } from './config/massage';
import { migrateConfig } from './config/migration';
import type { RenovateConfig } from './config/types';
import { validateConfig } from './config/validation';
import { logger } from './logger';

/* eslint-disable no-console */

let returnVal = 0;

async function validate(
  desc: string,
  config: RenovateConfig,
  isPreset = false
): Promise<void> {
  const { isMigrated, migratedConfig } = migrateConfig(config);
  if (isMigrated) {
    logger.warn(
      {
        oldConfig: config,
        newConfig: migratedConfig,
      },
      'Config migration necessary'
    );
  }
  const massagedConfig = massageConfig(migratedConfig);
  const res = await validateConfig(massagedConfig, isPreset);
  if (res.errors.length) {
    logger.error({ errors: res.errors }, `${desc} contains errors`);
    returnVal = 1;
  }
  if (res.warnings.length) {
    logger.warn({ warnings: res.warnings }, `${desc} contains warnings`);
    returnVal = 1;
  }
}

type PackageJson = {
  renovate?: RenovateConfig;
  'renovate-config'?: Record<string, RenovateConfig>;
};

(async () => {
  for (const file of configFileNames.filter(
    (name) => name !== 'package.json'
  )) {
    try {
      const rawContent = readFileSync(file, 'utf8');
      logger.info(`Validating ${file}`);
      try {
        let jsonContent: RenovateConfig;
        if (file.endsWith('.json5')) {
          jsonContent = JSON5.parse(rawContent);
        } else {
          jsonContent = JSON.parse(rawContent);
        }
        await validate(file, jsonContent);
      } catch (err) {
        logger.info({ err }, `${file} is not valid Renovate config`);
        returnVal = 1;
      }
    } catch (err) {
      // file does not exist
    }
  }
  try {
    const pkgJson = JSON.parse(
      readFileSync('package.json', 'utf8')
    ) as PackageJson;
    if (pkgJson.renovate) {
      logger.info(`Validating package.json > renovate`);
      await validate('package.json > renovate', pkgJson.renovate);
    }
    if (pkgJson['renovate-config']) {
      logger.info(`Validating package.json > renovate-config`);
      for (const presetConfig of Object.values(pkgJson['renovate-config'])) {
        await validate('package.json > renovate-config', presetConfig, true);
      }
    }
  } catch (err) {
    // ignore
  }
  try {
    const fileConfig = getFileConfig(process.env);
    if (!dequal(fileConfig, {})) {
      const file = process.env.RENOVATE_CONFIG_FILE ?? 'config.js';
      logger.info(`Validating ${file}`);
      try {
        await validate(file, fileConfig);
      } catch (err) {
        logger.error({ err }, `${file} is not valid Renovate config`);
        returnVal = 1;
      }
    }
  } catch (err) {
    // ignore
  }
  if (returnVal !== 0) {
    process.exit(returnVal);
  }
  logger.info('Config validated successfully');
})().catch((e) => {
  console.error(e);
  process.exit(99);
});
