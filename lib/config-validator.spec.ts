import fs from 'node:fs/promises';
import path from 'node:path';
import { codeBlock } from 'common-tags';
import { execa } from 'execa';
import { dir } from 'tmp-promise';
import { getConfigFileNames } from './config/app-strings.ts';
import type { AllConfig, RenovateConfig } from './config/types.ts';

const CLI = path.resolve('lib/config-validator.ts');

async function runValidator(args: string[], opts: { cwd?: string } = {}) {
  return execa('node', [CLI, ...args], {
    cwd: opts.cwd,
    reject: false,
    all: true,
    env: {
      ...process.env,
      LOG_LEVEL: 'info',
      LOG_FORMAT: 'json',
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
  });
});
