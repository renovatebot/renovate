#!/usr/bin/env node
// istanbul ignore file
import { readFileSync } from 'fs-extra';
import JSON5 from 'json5';
import { configFileNames } from './config/app-strings';
import { RenovateConfig } from './config/common';
import { getConfig as getFileConfig } from './config/file';
import { massageConfig } from './config/massage';
import { migrateConfig } from './config/migration';
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
    logger.info(
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
    console.log(
      `${desc} contains errors:\n\n${JSON.stringify(res.errors, null, 2)}`
    );
    returnVal = 1;
  }
  if (res.warnings.length) {
    console.log(
      `${desc} contains warnings:\n\n${JSON.stringify(res.warnings, null, 2)}`
    );
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
      console.log(`Validating ${file}`);
      try {
        let jsonContent;
        if (file.endsWith('.json5')) {
          jsonContent = JSON5.parse(rawContent) as PackageJson;
        } else {
          jsonContent = JSON.parse(rawContent) as PackageJson;
        }
        await validate(file, jsonContent);
      } catch (err) {
        console.log(`${file} is not valid Renovate config`, err);
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
      console.log(`Validating package.json > renovate`);
      await validate('package.json > renovate', pkgJson.renovate);
    }
    if (pkgJson['renovate-config']) {
      console.log(`Validating package.json > renovate-config`);
      for (const presetConfig of Object.values(pkgJson['renovate-config'])) {
        await validate('package.json > renovate-config', presetConfig, true);
      }
    }
  } catch (err) {
    // ignore
  }
  try {
    const fileConfig = getFileConfig(process.env);
    console.log(`Validating config.js`);
    try {
      await validate('config.js', fileConfig);
    } catch (err) {
      console.log(`config.js is not valid Renovate config`);
      returnVal = 1;
    }
  } catch (err) {
    // ignore
  }
  if (returnVal !== 0) {
    process.exit(returnVal);
  }
  console.log('OK');
})().catch((e) => {
  console.error(e);
  process.exit(99);
});
