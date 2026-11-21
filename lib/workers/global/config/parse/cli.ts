import { isPlainObject } from '@sindresorhus/is';
import { Command, Option } from 'commander';
import { repositoryCacheStates } from '../../../../config/migrations/custom/repository-cache-migration.ts';
import { getOptions } from '../../../../config/options/index.ts';
import type { AllConfig } from '../../../../config/types.ts';
import { pkg } from '../../../../expose.ts';
import { logger } from '../../../../logger/index.ts';
import { coerceObject } from '../../../../util/object.ts';
import { regEx } from '../../../../util/regex.ts';
import { coersions } from './coersions.ts';
import { type FlatOptions, flatOptionsByObject } from './flat-options.ts';
import type { ParseConfigOptions } from './types.ts';

export function getCliName(option: ParseConfigOptions): string {
  if (option.cli === false) {
    return '';
  }
  const nameWithHyphens = option.name.replace(
    regEx(/(?<upper>[A-Z])/g),
    '-$<upper>',
  );
  return `--${nameWithHyphens.toLowerCase()}`;
}

function createProgram(): Command<[string[]]> {
  const options = getOptions();

  let program = new Command().arguments('[repositories...]');

  options.forEach((option) => {
    if (option.cli !== false) {
      const param = `<${option.type}>`.replace('<boolean>', '[boolean]');
      const optionString = `${getCliName(option)} ${param}`;
      program = program.option(
        optionString,
        option.description,
        coersions[option.type],
      );
    }
  });

  // still accept the flags of the flat options which moved into an object, which `getConfig` migrates
  for (const flatOptions of Object.values(flatOptionsByObject)) {
    for (const [name, { type }] of Object.entries(flatOptions)) {
      const param = `<${type}>`.replace('<boolean>', '[boolean]');
      program = program.addOption(
        new Option(`${getCliName({ name })} ${param}`)
          .hideHelp()
          .argParser(coersions[type]),
      );
    }
  }

  /* oxlint-disable no-console -- intentional: CLI help output */
  /* istanbul ignore next */
  function helpConsole(): void {
    console.log('  Examples:');
    console.log('');
    console.log('    $ renovate --token 123test singapore/lint-condo');
    console.log(
      '    $ LOG_LEVEL=debug renovate --labels=renovate,dependency --ignore-unstable=false singapore/lint-condo',
    );
    console.log('    $ renovate singapore/lint-condo singapore/package-test');
    console.log(
      `    $ renovate singapore/lint-condo --onboarding-config='{"extends":["config:recommended"]}'`,
    );
    /* oxlint-enable no-console */
  }

  return program
    .version(pkg.version, '-v, --version')
    .on('--help', helpConsole);
}

/**
 * Massage migrated configuration keys.
 * This must run before any Commander parse call so that
 * deprecated/bare flags like `--dry-run` (no value) are rewritten
 * before Commander tries to consume them.
 */
function migrateArgs(input: string[]): string[] {
  return joinRepositoryCacheState(input)
    .map((a) =>
      a
        .replace(
          '--allow-post-upgrade-command-templating',
          '--allow-command-templating',
        )
        .replace('--allowed-post-upgrade-commands', '--allowed-commands')
        .replace('--endpoints=', '--host-rules=')
        .replace('--expose-env=true', '--trust-level=high')
        .replace('--expose-env', '--trust-level=high')
        .replace('--renovate-fork', '--include-forks')
        .replace('"platform":"', '"hostType":"')
        .replace('"endpoint":"', '"matchHost":"')
        .replace('"host":"', '"matchHost":"')
        .replace('--azure-auto-complete', '--platform-automerge') // migrate: azureAutoComplete
        .replace('--git-lab-automerge', '--platform-automerge') // migrate: gitLabAutomerge
        .replace(regEx(/^--dry-run$/), '--dry-run=true')
        .replace(regEx(/^--require-config$/), '--require-config=true')
        .replace('--aliases', '--registry-aliases')
        .replace('--include-forks=true', '--fork-processing=enabled')
        .replace('--include-forks', '--fork-processing=enabled')
        .replace('--recreate-closed=false', '--recreate-when=auto')
        .replace('--recreate-closed=true', '--recreate-when=always')
        .replace('--recreate-closed', '--recreate-when=always')
        .replace(
          regEx(/^--dependency-dashboard(?:=true)?$/),
          '--dependency-dashboard={"enabled":true}',
        )
        .replace(
          '--dependency-dashboard=false',
          '--dependency-dashboard={"enabled":false}',
        )
        .replace(
          regEx(/^--repository-cache=(?<state>disabled|enabled|reset)$/),
          '--repository-cache={"state":"$<state>"}',
        ),
    )
    .filter((a) => !a.startsWith('--git-fs'));
}

/**
 * Joins `--repository-cache <state>` into `--repository-cache=<state>`, so the state can be migrated into the `repositoryCache` object.
 */
function joinRepositoryCacheState(input: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < input.length; i++) {
    const state = input[i + 1];
    if (
      input[i] === '--repository-cache' &&
      repositoryCacheStates.includes(state)
    ) {
      result.push(`--repository-cache=${state}`);
      i++;
    } else {
      result.push(input[i]);
    }
  }
  return result;
}

export function parseEarlyFlags(input: string[] = process.argv): void {
  createProgram()
    .allowUnknownOption()
    .allowExcessArguments()
    .parse(migrateArgs(input));
}

export function getConfig(input: string[]): AllConfig {
  const argv = migrateArgs(input);
  const options = getOptions();

  const config: Record<string, any> = {};

  createProgram()
    .action((repositories: string[], opts: Record<string, unknown>) => {
      if (repositories?.length) {
        config.repositories = repositories;
      }

      for (const option of options) {
        if (option.cli !== false && opts[option.name] !== undefined) {
          config[option.name] = opts[option.name];
          if (option.name === 'dryRun') {
            if (config[option.name] === 'true') {
              logger.warn(
                'cli config dryRun property has been changed to full',
              );
              config[option.name] = 'full';
            } else if (config[option.name] === 'false') {
              logger.warn(
                'cli config dryRun property has been changed to null',
              );
              config[option.name] = null;
            } else if (config[option.name] === 'null') {
              config[option.name] = null;
            }
          }
          if (option.name === 'requireConfig') {
            if (config[option.name] === 'true') {
              logger.warn(
                'cli config requireConfig property has been changed to required',
              );
              config[option.name] = 'required';
            } else if (config[option.name] === 'false') {
              logger.warn(
                'cli config requireConfig property has been changed to optional',
              );
              config[option.name] = 'optional';
            }
          }
        }
      }

      for (const [objectName, flatOptions] of Object.entries(
        flatOptionsByObject,
      )) {
        migrateFlatOptionsFlags(opts, config, objectName, flatOptions);
      }
    })
    .parse(argv);

  return config;
}

/**
 * Moves the flags of the flat options into the flag of the object they moved into, where fields it already sets take precedence.
 *
 * e.g. --dependency-dashboard-footer=... -> --dependency-dashboard='{"footer":...}'
 */
function migrateFlatOptionsFlags(
  opts: Record<string, unknown>,
  config: Record<string, unknown>,
  objectName: string,
  flatOptions: FlatOptions,
): void {
  const migrated: Record<string, unknown> = {};
  const oldFlags: string[] = [];
  for (const [name, { field }] of Object.entries(flatOptions)) {
    if (opts[name] !== undefined) {
      migrated[field] = opts[name];
      oldFlags.push(getCliName({ name }));
    }
  }
  if (!oldFlags.length) {
    return;
  }

  const objectFlag = getCliName({ name: objectName });
  const existing = coerceObject(config[objectName]);
  if (!isPlainObject(existing)) {
    logger.warn(
      { objectFlag, oldFlags },
      'Could not migrate cli config into a grouped option, as it is not an object',
    );
    return;
  }
  config[objectName] = { ...migrated, ...existing };
  logger.warn(
    { objectFlag, oldFlags },
    'cli config has been migrated into a grouped option',
  );
}
