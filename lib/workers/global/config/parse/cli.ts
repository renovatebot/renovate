import { Command } from 'commander';
import { getOptions } from '../../../../config/options';
import type { AllConfig } from '../../../../config/types';
import { pkg } from '../../../../expose.cjs';
import { logger } from '../../../../logger';
import { regEx } from '../../../../util/regex';
import { coersions } from './coersions';
import type { ParseConfigOptions } from './types';

export function getCliName(option: ParseConfigOptions): string {
  if (option.cli === false) {
    return '';
  }
  const nameWithHyphens = option.name.replace(regEx(/([A-Z])/g), '-$1');
  return `--${nameWithHyphens.toLowerCase()}`;
}

export function getConfig(input: string[]): AllConfig {
  // massage migrated configuration keys
  const argv = input
    .map((a) =>
      a
        .replace('--endpoints=', '--host-rules=')
        .replace('--expose-env=true', '--trust-level=high')
        .replace('--expose-env', '--trust-level=high')
        .replace('--renovate-fork', '--include-forks')
        .replace('"platform":"', '"hostType":"')
        .replace('"endpoint":"', '"matchHost":"')
        .replace('"host":"', '"matchHost":"')
        .replace('--azure-auto-complete', '--platform-automerge') // migrate: azureAutoComplete
        .replace('--git-lab-automerge', '--platform-automerge') // migrate: gitLabAutomerge
        .replace(/^--dry-run$/, '--dry-run=true')
        .replace(/^--require-config$/, '--require-config=true')
        .replace('--aliases', '--registry-aliases')
        .replace('--include-forks=true', '--fork-processing=enabled')
        .replace('--include-forks', '--fork-processing=enabled')
        .replace('--recreate-closed=false', '--recreate-when=auto')
        .replace('--recreate-closed=true', '--recreate-when=always')
        .replace('--recreate-closed', '--recreate-when=always'),
    )
    .filter((a) => !a.startsWith('--git-fs'));
  const options = getOptions();

  const config: Record<string, any> = {};

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

  /* eslint-disable no-console */
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
    /* eslint-enable no-console */
  }

  program = program
    .version(pkg.version, '-v, --version')
    .on('--help', helpConsole)
    .action((repositories: string[], opts: Record<string, unknown>) => {
      if (repositories?.length) {
        config.repositories = repositories;
      }

      for (const option of options) {
        if (option.cli !== false) {
          if (opts[option.name] !== undefined) {
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
      }
    })
    .parse(argv);

  return config;
}
