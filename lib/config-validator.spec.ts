import fs from 'node:fs/promises';
import path from 'node:path';
import { codeBlock } from 'common-tags';
import { execa } from 'execa';
import { dir } from 'tmp-promise';
import { getConfigFileNames } from './config/app-strings.ts';
import type { AllConfig, RenovateConfig } from './config/types.ts';

const CLI = path.resolve('lib/config-validator.ts');

async function runValidator(
  args: string[],
  opts: { cwd?: string; env?: Record<string, string> } = {},
) {
  return execa('node', [CLI, ...args], {
    cwd: opts.cwd,
    reject: false,
    all: true,
    env: {
      ...process.env,
      LOG_LEVEL: 'info',
      LOG_FORMAT: 'json',
      ...opts.env,
    },
  });
}

async function withTmpDir<T>(fn: (dirPath: string) => Promise<T>): Promise<T> {
  const tmpDir = await dir({ unsafeCleanup: true });
  try {
    return await fn(tmpDir.path);
  } finally {
    await tmpDir.cleanup();
  }
}

async function writeRepoConfig(
  dirPath: string,
  name: string,
  content: RenovateConfig,
): Promise<string> {
  const filePath = path.join(dirPath, name);
  await fs.writeFile(filePath, JSON.stringify(content, null, 2));
  return filePath;
}

async function writeGlobalConfig(
  dirPath: string,
  name: string,
  content: AllConfig,
): Promise<string> {
  const filePath = path.join(dirPath, name);
  await fs.writeFile(filePath, JSON.stringify(content, null, 2));
  return filePath;
}

describe.concurrent('config-validator', () => {
  describe('--version', () => {
    it('exits 0 and prints version', async () => {
      const { exitCode, stdout } = await runValidator(['-v']);

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/\d+\.\d+/);
    });
  });

  describe('explicit file arguments', () => {
    it('exits 0 for a valid repo config', async () => {
      await withTmpDir(async (dirPath) => {
        const file = await writeRepoConfig(dirPath, 'renovate.json', {
          extends: ['config:recommended'],
        });

        const { exitCode, all } = await runValidator(['--no-global', file]);

        expect(exitCode).toBe(0);
        expect(all).toContain(
          'Config validated successfully against 1 file(s)',
        );
      });
    });

    it('exits 1 for a config with an unknown option', async () => {
      await withTmpDir(async (dirPath) => {
        // oxlint-disable-next-line renovate/prefer-partial-in-specs -- intentionally invalid unknown option to test validator error handling
        const file = await writeRepoConfig(dirPath, 'renovate.json', {
          notARealOption: true,
        } as RenovateConfig);

        const { exitCode, all } = await runValidator(['--no-global', file]);

        expect(exitCode).toBe(1);
        expect(all).toContain('Found errors in configuration');
      });
    });

    it('exits 1 when the file does not exist', async () => {
      const { exitCode, all } = await runValidator([
        '--no-global',
        '/tmp/does-not-exist-renovate.json',
      ]);

      expect(exitCode).toBe(1);
      expect(all).toContain('File does not exist');
    });

    it('exits 0 without --strict when migration is needed', async () => {
      await withTmpDir(async (dirPath) => {
        const file = await writeRepoConfig(dirPath, 'renovate.json', {
          packageRules: [
            {
              // @ts-expect-error -- intentionally using an unmigrated config fields
              packagePatterns: ['foo'],
              updateTypes: ['major'],
              automerge: true,
            },
          ],
        });

        const { exitCode, all } = await runValidator(['--no-global', file]);

        expect(exitCode).toBe(0);
        expect(all).toContain('Config migration necessary');
      });
    });

    it('exits 1 with --strict when migration is needed', async () => {
      await withTmpDir(async (dirPath) => {
        const file = await writeRepoConfig(dirPath, 'renovate.json', {
          packageRules: [
            {
              // @ts-expect-error -- intentionally using unmigrated config fields
              packagePatterns: ['foo'],
              updateTypes: ['major'],
              automerge: true,
            },
          ],
        });

        const { exitCode, all } = await runValidator([
          '--no-global',
          '--strict',
          file,
        ]);

        expect(exitCode).toBe(1);
        expect(all).toContain('Config migration necessary');
      });
    });

    it('applies the migration with --migrate, keeping comments, so --strict passes', async () => {
      await withTmpDir(async (dirPath) => {
        const file = path.join(dirPath, 'renovate.jsonc');
        await fs.writeFile(
          file,
          codeBlock`
            {
              // keep this comment
              "extends": ["config:base"],
              "packageRules": [
                {
                  "packagePatterns": ["foo"],
                  "automerge": true
                }
              ]
            }
          `,
        );

        const { exitCode, all } = await runValidator([
          '--no-global',
          '--strict',
          '--migrate',
          file,
        ]);

        expect(exitCode).toBe(0);
        expect(all).toContain('Applied config migration');
        await expect(fs.readFile(file, 'utf8')).resolves.toBe(
          `${codeBlock`
            {
              // keep this comment
              "extends": ["config:recommended"],
              "packageRules": [
                {
                  "automerge": true,
                  "matchPackageNames": [
                    "/foo/"
                  ]
                }
              ]
            }
          `}\n`,
        );
      });
    });

    it('does not rewrite a file that needs no migration with --migrate', async () => {
      await withTmpDir(async (dirPath) => {
        const file = path.join(dirPath, 'renovate.json');
        const content = '{"extends":   ["config:recommended"]}';
        await fs.writeFile(file, content);

        const { exitCode } = await runValidator([
          '--no-global',
          '--migrate',
          file,
        ]);

        expect(exitCode).toBe(0);
        await expect(fs.readFile(file, 'utf8')).resolves.toBe(content);
      });
    });

    it('does not apply the migration to an unsupported file type with --migrate', async () => {
      await withTmpDir(async (dirPath) => {
        const file = path.join(dirPath, 'renovate.yaml');
        const content = 'extends:\n  - config:base\n';
        await fs.writeFile(file, content);

        const { exitCode, all } = await runValidator([
          '--no-global',
          '--strict',
          '--migrate',
          file,
        ]);

        expect(exitCode).toBe(1);
        expect(all).toContain(
          'Config migration cannot be applied automatically to this file type',
        );
        await expect(fs.readFile(file, 'utf8')).resolves.toBe(content);
      });
    });

    it('reports a migration that could not be written with --migrate, without calling the config invalid', async () => {
      await withTmpDir(async (dirPath) => {
        const file = path.join(dirPath, 'renovate.json');
        const content = '{"extends":["config:base"]}';
        await fs.writeFile(file, content);
        await fs.chmod(file, 0o444);

        const { exitCode, all } = await runValidator([
          '--no-global',
          '--strict',
          '--migrate',
          file,
        ]);

        expect(exitCode).toBe(1);
        expect(all).toContain('Config migration could not be written');
        expect(all).not.toContain('File is not valid Renovate config');
        await expect(fs.readFile(file, 'utf8')).resolves.toBe(content);
      });
    });

    it('treats file as global config by default', async () => {
      await withTmpDir(async (dirPath) => {
        const file = await writeGlobalConfig(dirPath, 'config.json', {
          platform: 'github',
          repositories: ['foo/bar'],
        });

        const { exitCode } = await runValidator([file]);

        expect(exitCode).toBe(0);
      });
    });

    it('treats file as repo config with --no-global', async () => {
      await withTmpDir(async (dirPath) => {
        const file = await writeRepoConfig(dirPath, 'renovate.json', {
          extends: ['config:recommended'],
        });

        const { exitCode, all } = await runValidator(['--no-global', file]);

        expect(exitCode).toBe(0);
        expect(all).toContain('Validating');
        expect(all).toContain('as repo config');
      });
    });
  });

  describe('regex engine', () => {
    it('logs that validation may be inaccurate when RE2 is not used', async () => {
      await withTmpDir(async (dirPath) => {
        const { all } = await runValidator([], {
          cwd: dirPath,
          env: { LOG_LEVEL: 'debug', RENOVATE_X_IGNORE_RE2: 'true' },
        });

        expect(all).toContain('regex validation may be inaccurate');
      });
    });
  });

  describe('auto-discovery (no file arguments)', () => {
    it('exits 0 with no warning when no config files are present', async () => {
      await withTmpDir(async (dirPath) => {
        const { exitCode, all } = await runValidator([], { cwd: dirPath });

        expect(exitCode).toBe(0);
        expect(all).toContain(
          'No files to perform configuration validation against',
        );
      });
    });

    const autoDiscoveredFiles = getConfigFileNames().filter(
      (name) => name !== 'package.json',
    );

    it.each(autoDiscoveredFiles)(
      'exits 0 for a valid config in %s',
      async (configFile) => {
        await withTmpDir(async (dirPath) => {
          const fullPath = path.join(dirPath, configFile);
          await fs.mkdir(path.dirname(fullPath), { recursive: true });
          await fs.writeFile(
            fullPath,
            JSON.stringify({ extends: ['config:recommended'] }),
          );

          const { exitCode, all } = await runValidator([], { cwd: dirPath });

          expect(exitCode).toBe(0);
          expect(all).toContain(
            'Config validated successfully against 1 file(s)',
          );
        });
      },
    );

    it.each(autoDiscoveredFiles)(
      'exits 1 for an invalid config in %s',
      async (configFile) => {
        await withTmpDir(async (dirPath) => {
          const fullPath = path.join(dirPath, configFile);
          await fs.mkdir(path.dirname(fullPath), { recursive: true });
          await fs.writeFile(
            fullPath,
            JSON.stringify({ notARealOption: true }),
          );

          const { exitCode, all } = await runValidator([], { cwd: dirPath });

          expect(exitCode).toBe(1);
          expect(all).toContain('Found errors in configuration');
        });
      },
    );

    it('validates JSONC comment syntax in .jsonc files', async () => {
      await withTmpDir(async (dirPath) => {
        const fullPath = path.join(dirPath, 'renovate.jsonc');
        await fs.writeFile(
          fullPath,
          codeBlock`
            {
              // Use the recommended preset
              "extends": ["config:recommended"]
            }
          `,
        );

        const { exitCode, all } = await runValidator([], { cwd: dirPath });

        expect(exitCode).toBe(0);
        expect(all).toContain(
          'Config validated successfully against 1 file(s)',
        );
      });
    });

    it('validates JSON5 syntax in .json5 files', async () => {
      await withTmpDir(async (dirPath) => {
        const fullPath = path.join(dirPath, 'renovate.json5');
        await fs.writeFile(
          fullPath,
          codeBlock`
            {
              // trailing commas and unquoted keys are valid JSON5
              extends: ["config:recommended"],
            }
          `,
        );

        const { exitCode, all } = await runValidator([], { cwd: dirPath });

        expect(exitCode).toBe(0);
        expect(all).toContain(
          'Config validated successfully against 1 file(s)',
        );
      });
    });

    it('validates package.json renovate-config presets', async () => {
      await withTmpDir(async (dirPath) => {
        await fs.writeFile(
          path.join(dirPath, 'package.json'),
          JSON.stringify({
            name: 'test',
            'renovate-config': {
              default: { extends: ['config:recommended'] },
            },
          }),
        );

        const { exitCode, all } = await runValidator([], { cwd: dirPath });

        expect(exitCode).toBe(0);
        expect(all).toContain('Validating package.json > renovate-config');
      });
    });

    it('validates package.json renovate field', async () => {
      await withTmpDir(async (dirPath) => {
        await fs.writeFile(
          path.join(dirPath, 'package.json'),
          JSON.stringify({
            name: 'test',
            renovate: { extends: ['config:recommended'] },
          }),
        );

        const { exitCode, all } = await runValidator([], { cwd: dirPath });

        expect(exitCode).toBe(0);
        expect(all).toContain('Validating package.json > renovate');
      });
    });

    it('does not overwrite package.json with its renovate config with --migrate', async () => {
      await withTmpDir(async (dirPath) => {
        const pkgJson = path.join(dirPath, 'package.json');
        const content = JSON.stringify({
          name: 'test',
          renovate: { extends: ['config:base'] },
        });
        await fs.writeFile(pkgJson, content);

        const { all } = await runValidator(['--migrate'], { cwd: dirPath });

        expect(all).toContain(
          'Config migration cannot be applied automatically to this file type',
        );
        await expect(fs.readFile(pkgJson, 'utf8')).resolves.toBe(content);
      });
    });
  });

  describe('hostRules', () => {
    it('registers the configured platform token as a host rule', async () => {
      await withTmpDir(async (dirPath) => {
        const { exitCode, all } = await runValidator([], {
          cwd: dirPath,
          env: {
            LOG_LEVEL: 'debug',
            RENOVATE_ENDPOINT: 'https://gitlab.example.com/api/v4/',
            RENOVATE_PLATFORM: 'gitlab',
            RENOVATE_TOKEN: 'test-token',
          },
        });

        expect(exitCode).toBe(0);
        expect(all).toContain(
          'Adding token authentication for gitlab.example.com (hostType=gitlab) to hostRules',
        );
      });
    });

    it("does not drop the self-hosted admin's own hostRules headers against allowedHeaders when registering them", async () => {
      // `allowedHeaders` constrains what a repository or preset may set, not the self-hosted administrator - `hostRules.add()` no longer filters (and warns about) the admin's own headers
      //
      // this does not (yet) extend to the separate, pre-existing top-level config security validation in `lib/config/validation.ts`, which still reports a global config's own `hostRules[].headers` outside its own `allowedHeaders` as a `Config security error` - the same limitation `allowedEnv`/`env` already have there, so `exitCode` is still 1 here
      await withTmpDir(async (dirPath) => {
        const configFile = await writeGlobalConfig(dirPath, 'config.json', {
          allowedHeaders: ['X-*'],
          hostRules: [
            {
              matchHost: 'registry.example.com',
              headers: { 'X-Allowed': 'yes', Authorization: 'from-admin' },
            },
          ],
        });

        const { exitCode, all } = await runValidator([], {
          cwd: dirPath,
          env: { RENOVATE_CONFIG_FILE: configFile },
        });

        expect(all).not.toContain(
          "Ignoring hostRules headers not permitted by this Renovate instance's `allowedHeaders`",
        );
        expect(exitCode).toBe(1);
        expect(all).toContain(
          "hostRules header `Authorization` is not allowed by this Renovate instance's `allowedHeaders`.",
        );
      });
    });

    it('filters hostRules headers of a validated config file against allowedHeaders', async () => {
      await withTmpDir(async (dirPath) => {
        const file = await writeRepoConfig(dirPath, 'renovate.json', {
          hostRules: [
            {
              matchHost: 'registry.example.com',
              headers: { 'X-Allowed': 'yes', Authorization: 'denied' },
            },
          ],
        });

        const { all } = await runValidator(['--no-global', file], {
          env: { RENOVATE_ALLOWED_HEADERS: '["X-*"]' },
        });

        expect(all).toContain(
          "Ignoring hostRules headers not permitted by this Renovate instance's `allowedHeaders`",
        );
        expect(all).toContain('Authorization');
      });
    });
  });
});
