#!/usr/bin/env node
// istanbul ignore file
import 'source-map-support/register';
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

async function validate(
  configType: 'global' | 'repo',
  desc: string,
  config: RenovateConfig,
  strict: boolean,
  isPreset = false,
): Promise<void> {
  const { isMigrated, migratedConfig } = migrateConfig(config);
  if (isMigrated) {
    logger.warn(
      {
        oldConfig: config,
        newConfig: migratedConfig,
      },
      'Config migration necessary',
    );
    if (strict) {
      returnVal = 1;
    }
  }
  const massagedConfig = massageConfig(migratedConfig);
  const res = await validateConfig(configType, massagedConfig, isPreset);
  if (res.errors.length) {
    logger.error(
      { file: desc, errors: res.errors },
      'Found errors in configuration',
    );
    returnVal = 1;
  }
  if (res.warnings.length) {
    logger.warn(
      { file: desc, warnings: res.warnings },
      'Found errors in configuration',
    );
    returnVal = 1;
  }
}

type PackageJson = {
  renovate?: RenovateConfig;
  'renovate-config'?: Record<string, RenovateConfig>;
};

(async () => {
  const strictArgIndex = process.argv.indexOf('--strict');
  const strict = strictArgIndex >= 0;
  if (strict) {
    process.argv.splice(strictArgIndex, 1);
  }
  if (process.argv.length > 2) {
    for (const file of process.argv.slice(2)) {
      try {
        if (!(await pathExists(file))) {
          returnVal = 1;
          logger.error({ file }, 'File does not exist');
          break;
        }
        const parsedContent = await getParsedContent(file);
        try {
          logger.info(`Validating ${file}`);
          await validate('global', file, parsedContent, strict);
        } catch (err) {
          logger.warn({ file, err }, 'File is not valid Renovate config');
          returnVal = 1;
        }
      } catch (err) {
        logger.warn({ file, err }, 'File could not be parsed');
        returnVal = 1;
      }
    }
  } else {
    for (const file of configFileNames.filter(
      (name) => name !== 'package.json',
    )) {
      try {
        if (!(await pathExists(file))) {
          continue;
        }
        const parsedContent = await getParsedContent(file);
        try {
          logger.info(`Validating ${file}`);
          await validate('repo', file, parsedContent, strict);
        } catch (err) {
          logger.warn({ file, err }, 'File is not valid Renovate config');
          returnVal = 1;
        }
      } catch (err) {
        logger.warn({ file, err }, 'File could not be parsed');
        returnVal = 1;
      }
    }
    try {
      const pkgJson = JSON.parse(
        await readFile('package.json', 'utf8'),
      ) as PackageJson;
      if (pkgJson.renovate) {
        logger.info(`Validating package.json > renovate`);
        await validate(
          'repo',
          'package.json > renovate',
          pkgJson.renovate,
          strict,
        );
      }
      if (pkgJson['renovate-config']) {
        logger.info(`Validating package.json > renovate-config`);
        for (const presetConfig of Object.values(pkgJson['renovate-config'])) {
          await validate(
            'repo',
            'package.json > renovate-config',
            presetConfig,
            strict,
            true,
          );
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
          await validate('global', file, fileConfig, strict);
        } catch (err) {
          logger.error({ file, err }, 'File is not valid Renovate config');
          returnVal = 1;
        }
      }
    } catch (err) {
      // ignore
    }
  }
  if (returnVal !== 0) {
    process.exit(returnVal);
  }
  logger.info('Config validated successfully');
})().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(99);
});
