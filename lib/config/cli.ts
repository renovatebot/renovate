import { Command } from 'commander';
import { version } from '../../package.json';
import { getOptions } from './definitions';
import type { GlobalConfig, RenovateOptions } from './types';

export function getCliName(option: Partial<RenovateOptions>): string {
  if (option.cli === false) {
    return '';
  }
  const nameWithHyphens = option.name.replace(/([A-Z])/g, '-$1');
  return `--${nameWithHyphens.toLowerCase()}`;
}

export interface RenovateCliConfig extends Record<string, any> {
  repositories?: string[];
}

export function getConfig(input: string[]): GlobalConfig {
  // massage migrated configuration keys
  const argv = input
    .map((a) =>
      a
        .replace('--endpoints=', '--host-rules=')
        .replace('--expose-env=true', '--trust-level=high')
        .replace('--expose-env', '--trust-level=high')
        .replace('--renovate-fork', '--include-forks')
        .replace('"platform":"', '"hostType":"')
        .replace('"endpoint":"', '"baseUrl":"')
        .replace('"host":"', '"hostName":"')
    )
    .filter((a) => !a.startsWith('--git-fs'));
  const options = getOptions();

  const config: RenovateCliConfig = {};

  const coersions: Record<string, (arg: string) => unknown> = {
    boolean: (val: string): boolean => {
      if (val === 'true' || val === '') {
        return true;
      }
      if (val === 'false') {
        return false;
      }
      throw new Error(
        "Invalid boolean value: expected 'true' or 'false', but got '" +
          val +
          "'"
      );
    },
    array: (val: string): string[] => {
      if (val === '') {
        return [];
      }
      try {
        return JSON.parse(val);
      } catch (err) {
        return val.split(',').map((el) => el.trim());
      }
    },
    object: (val: string): any => {
      if (val === '') {
        return {};
      }
      try {
        return JSON.parse(val);
      } catch (err) {
        throw new Error("Invalid JSON value: '" + val + "'");
      }
    },
    string: (val: string): string => val,
    integer: parseInt,
  };

  let program = new Command()
    .storeOptionsAsProperties(false)
    .passCommandToAction(false)
    .arguments('[repositories...]');

  options.forEach((option) => {
    if (option.cli !== false) {
      const param = `<${option.type}>`.replace('<boolean>', '[boolean]');
      const optionString = `${getCliName(option)} ${param}`;
      program = program.option(
        optionString,
        option.description,
        coersions[option.type]
      );
    }
  });

  /* istanbul ignore next */
  function helpConsole(): void {
    /* eslint-disable no-console */
    console.log('  Examples:');
    console.log('');
    console.log('    $ renovate --token abc123 singapore/lint-condo');
    console.log(
      '    $ renovate --labels=renovate,dependency --ignore-unstable=false --log-level debug singapore/lint-condo'
    );
    console.log('    $ renovate singapore/lint-condo singapore/package-test');
    console.log(
      `    $ renovate singapore/lint-condo --onboarding-config='{"extends":["config:base"]}'`
    );
    /* eslint-enable no-console */
  }

  program = program
    .version(version, '-v, --version')
    .on('--help', helpConsole)
    .action((repositories: string[], opts: Record<string, unknown>) => {
      if (repositories?.length) {
        config.repositories = repositories;
      }

      for (const option of options) {
        if (option.cli !== false) {
          if (opts[option.name] !== undefined) {
            config[option.name] = opts[option.name];
          }
        }
      }
    })
    .parse(argv);

  return config;
}
