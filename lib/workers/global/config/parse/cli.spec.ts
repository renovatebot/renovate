import { DockerDatasource } from '../../../../modules/datasource/docker';
import getArgv from './__fixtures__/argv';
import * as cli from './cli';
import type { ParseConfigOptions } from './types';

describe('workers/global/config/parse/cli', () => {
  let argv: string[];

  beforeEach(() => {
    argv = getArgv();
  });

  describe('.getCliName(definition)', () => {
    it('generates CLI value', () => {
      const option: ParseConfigOptions = {
        name: 'oneTwoThree',
      };
      expect(cli.getCliName(option)).toBe('--one-two-three');
    });

    it('generates returns empty if CLI false', () => {
      const option: ParseConfigOptions = {
        name: 'oneTwoThree',
        cli: false,
      };
      expect(cli.getCliName(option)).toBe('');
    });
  });

  describe('.getConfig(argv)', () => {
    it('returns empty argv', () => {
      expect(cli.getConfig(argv)).toEqual({});
    });

    it('supports boolean no value', () => {
      argv.push('--config-migration');
      expect(cli.getConfig(argv)).toEqual({ configMigration: true });
      argv = argv.slice(0, -1);
    });

    it('supports boolean space true', () => {
      argv.push('--config-migration');
      argv.push('true');
      expect(cli.getConfig(argv)).toEqual({ configMigration: true });
    });

    it('throws exception for invalid boolean value', () => {
      argv.push('--config-migration');
      argv.push('badvalue');
      expect(() => cli.getConfig(argv)).toThrow(
        Error(
          "Invalid boolean value: expected 'true' or 'false', but got 'badvalue'",
        ),
      );
    });

    it('supports boolean space false', () => {
      argv.push('--config-migration');
      argv.push('false');
      expect(cli.getConfig(argv)).toEqual({ configMigration: false });
    });

    it('supports boolean equals true', () => {
      argv.push('--config-migration=true');
      expect(cli.getConfig(argv)).toEqual({ configMigration: true });
    });

    it('supports boolean equals false', () => {
      argv.push('--config-migration=false');
      expect(cli.getConfig(argv)).toEqual({ configMigration: false });
    });

    it('supports list single', () => {
      argv.push('--labels=a');
      expect(cli.getConfig(argv)).toEqual({ labels: ['a'] });
    });

    it('supports list multiple', () => {
      argv.push('--labels=a,b,c');
      expect(cli.getConfig(argv)).toEqual({ labels: ['a', 'b', 'c'] });
    });

    it('supports string', () => {
      argv.push('--token=a');
      expect(cli.getConfig(argv)).toEqual({ token: 'a' });
    });

    it('supports repositories', () => {
      argv.push('foo');
      argv.push('bar');
      expect(cli.getConfig(argv)).toEqual({ repositories: ['foo', 'bar'] });
    });

    it('parses json lists correctly', () => {
      argv.push(
        `--host-rules=[{"matchHost":"docker.io","hostType":"${DockerDatasource.id}","username":"user","password":"password"}]`,
      );
      expect(cli.getConfig(argv)).toEqual({
        hostRules: [
          {
            matchHost: 'docker.io',
            hostType: DockerDatasource.id,
            username: 'user',
            password: 'password',
          },
        ],
      });
    });

    it('parses [] correctly as empty list of hostRules', () => {
      argv.push(`--host-rules=[]`);
      expect(cli.getConfig(argv)).toEqual({
        hostRules: [],
      });
    });

    it('parses an empty string correctly as empty list of hostRules', () => {
      argv.push(`--host-rules=`);
      expect(cli.getConfig(argv)).toEqual({
        hostRules: [],
      });
    });

    it.each`
      arg                              | config
      ${'--endpoints='}                | ${{ hostRules: [] }}
      ${'--azure-auto-complete=false'} | ${{ platformAutomerge: false }}
      ${'--azure-auto-complete=true'}  | ${{ platformAutomerge: true }}
      ${'--azure-auto-complete'}       | ${{ platformAutomerge: true }}
      ${'--git-lab-automerge=false'}   | ${{ platformAutomerge: false }}
      ${'--git-lab-automerge=true'}    | ${{ platformAutomerge: true }}
      ${'--git-lab-automerge'}         | ${{ platformAutomerge: true }}
      ${'--recreate-closed=false'}     | ${{ recreateWhen: 'auto' }}
      ${'--recreate-closed=true'}      | ${{ recreateWhen: 'always' }}
      ${'--recreate-closed'}           | ${{ recreateWhen: 'always' }}
      ${'--recreate-when=auto'}        | ${{ recreateWhen: 'auto' }}
      ${'--recreate-when=always'}      | ${{ recreateWhen: 'always' }}
      ${'--recreate-when=never'}       | ${{ recreateWhen: 'never' }}
    `('"$arg" -> $config', ({ arg, config }) => {
      argv.push(arg);
      expect(cli.getConfig(argv)).toMatchObject(config);
    });

    it('parses json object correctly when empty', () => {
      argv.push(`--onboarding-config=`);
      expect(cli.getConfig(argv)).toEqual({
        onboardingConfig: {},
      });
    });

    it('parses json {} object correctly', () => {
      argv.push(`--onboarding-config={}`);
      expect(cli.getConfig(argv)).toEqual({
        onboardingConfig: {},
      });
    });

    it('parses json object correctly', () => {
      argv.push(`--onboarding-config={"extends": ["config:recommended"]}`);
      expect(cli.getConfig(argv)).toEqual({
        onboardingConfig: {
          extends: ['config:recommended'],
        },
      });
    });

    it('throws exception for invalid json object', () => {
      argv.push('--onboarding-config=Hello_World');
      expect(() => cli.getConfig(argv)).toThrow(
        Error("Invalid JSON value: 'Hello_World'"),
      );
    });

    it('dryRun boolean true', () => {
      argv.push('--dry-run=true');
      expect(cli.getConfig(argv)).toEqual({ dryRun: 'full' });
    });

    it('dryRun no value', () => {
      argv.push('--dry-run');
      expect(cli.getConfig(argv)).toEqual({ dryRun: 'full' });
    });

    it('dryRun boolean false', () => {
      argv.push('--dry-run=false');
      expect(cli.getConfig(argv)).toEqual({ dryRun: null });
    });

    it('dryRun  null', () => {
      argv.push('--dry-run=null');
      expect(cli.getConfig(argv)).toEqual({ dryRun: null });
    });

    it('requireConfig boolean true', () => {
      argv.push('--require-config=true');
      expect(cli.getConfig(argv)).toEqual({ requireConfig: 'required' });
    });

    it('requireConfig no value', () => {
      argv.push('--require-config');
      expect(cli.getConfig(argv)).toEqual({ requireConfig: 'required' });
    });

    it('requireConfig boolean false', () => {
      argv.push('--require-config=false');
      expect(cli.getConfig(argv)).toEqual({ requireConfig: 'optional' });
    });
  });
});
