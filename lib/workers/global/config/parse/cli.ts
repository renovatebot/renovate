import { Command } from 'commander';
import { getOptions } from '../../../../config/options/index.ts';
import type { AllConfig } from '../../../../config/types.ts';
import { pkg } from '../../../../expose.ts';
import { regEx } from '../../../../util/regex.ts';
import { coersions } from './coersions.ts';
import type { ParseConfigOptions } from './types.ts';
import { migrateGlobalConfig } from './util.ts';

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
 * Rewrite deprecated command line syntax.
 * Commander only knows the flags of the options which currently exist, so
 * renamed and removed flags have to be rewritten or dropped before any
 * Commander parse call. Value migrations are left to `migrateGlobalConfig()`.
 */
function migrateArgs(input: string[]): string[] {
  return input
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
        .replace('--azure-auto-complete', '--platform-automerge') // migrate: azureAutoComplete
        .replace('--git-lab-automerge', '--platform-automerge') // migrate: gitLabAutomerge
        .replace(regEx(/^--dry-run$/), '--dry-run=true')
        .replace(regEx(/^--require-config$/), '--require-config=true')
        .replace('--aliases', '--registry-aliases')
        .replace('--include-forks=true', '--fork-processing=enabled')
        .replace('--include-forks', '--fork-processing=enabled')
        .replace('--recreate-closed=false', '--recreate-when=auto')
        .replace('--recreate-closed=true', '--recreate-when=always')
        .replace('--recreate-closed', '--recreate-when=always'),
    )
    .filter((a) => !a.startsWith('--git-fs'));
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
        }
      }
    })
    .parse(argv);

  return migrateGlobalConfig(config as AllConfig, 'cli');
}
