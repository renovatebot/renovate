#!/usr/bin/env node
// istanbul ignore file
import { dequal } from 'dequal';
import { pathExists, readFile } from 'fs-extra';
import { configFileNames } from './config/app-strings';
import { massageConfig } from './config/massage';
import { migrateConfig } from './config/migration';
import type { RenovateConfig } from './config/types';
import { validateConfig } from './config/validation';
import { logger } from './logger';
import {
  getConfig as getFileConfig,
  getParsedContent,
} from './workers/global/config/parse/file';

let returnVal = 0;

/* eslint-disable no-console */

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
      if (!(await pathExists(file))) {
        continue;
      }
      const parsedContent = await getParsedContent(file);
      try {
        logger.info(`Validating ${file}`);
        await validate(file, parsedContent);
      } catch (err) {
        logger.warn({ err }, `${file} is not valid Renovate config`);
        returnVal = 1;
      }
    } catch (err) {
      logger.warn({ err }, `${file} could not be parsed`);
      returnVal = 1;
    }
  }
  try {
    const pkgJson = JSON.parse(
      await readFile('package.json', 'utf8')
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
    const fileConfig = await getFileConfig(process.env);
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
