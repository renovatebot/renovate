#!/usr/bin/env node
import { Command, CommanderError } from 'commander';
import 'source-map-support/register';
import './punycode.cjs';
import { dequal } from 'dequal';
import { pathExists, readFile } from 'fs-extra';
import { getConfigFileNames } from './config/app-strings';
import { massageConfig } from './config/massage';
import { migrateConfig } from './config/migration';
import type { RenovateConfig } from './config/types';
import { validateConfig } from './config/validation';
import { pkg } from './expose.cjs';
import { logger } from './logger';
import { getEnv } from './util/env';
import { getConfig as getFileConfig } from './workers/global/config/parse/file';
import { getParsedContent } from './workers/global/config/parse/util';

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

interface PackageJson {
  renovate?: RenovateConfig;
  'renovate-config'?: Record<string, RenovateConfig>;
}

(async () => {
  const program = new Command('renovate-config-validator')
    .summary('Validate Renovate configuration files')
    .description(
      `Validate your Renovate configuration (repo config, shared presets or global configuration) files\n` +
        'If no [config-files...] are given, renovate-config-validator will look at the default config file locations (https://docs.renovatebot.com/configuration-options/)',
    )
    .addHelpText(
      'after',
      `
When specifying [config-files...], Renovate will treat them as global self-hosted configuration files. You can disable this behaviour with --no-global

Examples:

  $ renovate-config-validator
  $ renovate-config-validator --strict
  $ renovate-config-validator first_config.json
  $ renovate-config-validator --strict config.js
  $ renovate-config-validator --no-global renovate.json5
  $ env RENOVATE_CONFIG_FILE=obscure-name.json renovate-config-validator`,
    )
    .argument('[config-files...]')
    .version(pkg.version, '-v, --version')
    .option(
      '--strict',
      'Fail command if any configuration warnings, errors, or a migration is needed',
    )
    .option(
      '--no-global',
      'When specifying [config-files], do not treat them as global self-hosted configuration file(s)',
      true,
    )
    // allow us to manage the exit code
    .exitOverride();

  program.action(async (files, opts) => {
    const strict = opts.strict ?? false;

    if (files.length) {
      let isGlobalConfig = true;
      if (opts.global === false) {
        isGlobalConfig = false;
      }
      const configType = isGlobalConfig ? 'global' : 'repo';
      for (const file of files) {
        try {
          if (!(await pathExists(file))) {
            returnVal = 1;
            logger.error({ file }, 'File does not exist');
            break;
          }
          const parsedContent = await getParsedContent(file);
          try {
            logger.info(`Validating ${file} as ${configType} config`);
            await validate(configType, file, parsedContent, strict);
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
      for (const file of getConfigFileNames().filter(
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
          for (const presetConfig of Object.values(
            pkgJson['renovate-config'],
          )) {
            await validate(
              'repo',
              'package.json > renovate-config',
              presetConfig,
              strict,
              true,
            );
          }
        }
      } catch {
        // ignore
      }
      try {
        const env = getEnv();
        const fileConfig = await getFileConfig(env);
        if (!dequal(fileConfig, {})) {
          const file = env.RENOVATE_CONFIG_FILE ?? 'config.js';
          logger.info(`Validating ${file}`);
          try {
            await validate('global', file, fileConfig, strict);
          } catch (err) {
            logger.error({ file, err }, 'File is not valid Renovate config');
            returnVal = 1;
          }
        }
      } catch {
        // ignore
      }
    }
    if (returnVal !== 0) {
      process.exit(returnVal);
    }
    logger.info('Config validated successfully');
  });

  await program.parseAsync();
})().catch((e) => {
  if (e instanceof CommanderError) {
    // Commander throws an error at the end of Action execution i.e. as part of the `help` command, and so we don't want to return an error code in this case
    if (e.code === 'commander.helpDisplayed') {
      return;
    }
  }

  // oxlint-disable-next-line no-console -- intentional: display critical error on CLI
  console.error(e);
  process.exit(99);
});
