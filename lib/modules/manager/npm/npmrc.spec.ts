import { fs } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { logger } from '../../../logger/index.ts';
import { resolveNpmrc } from './npmrc.ts';

vi.mock('../../../util/fs/index.ts');

function mockRepoNpmrc(content: string): void {
  fs.findLocalSiblingOrParent.mockResolvedValue('.npmrc');
  fs.readLocalFile.mockResolvedValue(content);
}

async function resolveRepoNpmrc(
  content: string,
  config: Parameters<typeof resolveNpmrc>[1] = {},
): Promise<string | undefined> {
  mockRepoNpmrc(content);

  const result = await resolveNpmrc('package.json', config);
  return result.npmrc;
}

describe('modules/manager/npm/npmrc', () => {
  describe('resolveNpmrc', () => {
    beforeEach(async () => {
      GlobalConfig.reset();
      const realFs = await vi.importActual<typeof fs>(
        '../../../util/fs/index.ts',
      );
      fs.readLocalFile.mockResolvedValue(null);
      fs.findLocalSiblingOrParent.mockResolvedValue(null);
      fs.getSiblingFileName.mockImplementation(realFs.getSiblingFileName);
    });

    it('returns undefined if no .npmrc exists and no config.npmrc', async () => {
      const res = await resolveNpmrc('package.json', {});
      expect(res).toStrictEqual({ npmrc: undefined, npmrcFileName: null });
    });

    it('uses config.npmrc if no .npmrc is found', async () => {
      const res = await resolveNpmrc('package.json', {
        npmrc: 'config-npmrc',
      });
      expect(res).toStrictEqual({ npmrc: 'config-npmrc', npmrcFileName: null });
    });

    it('finds and filters .npmrc', async () => {
      fs.findLocalSiblingOrParent.mockImplementation(
        (packageFile, configFile): Promise<string | null> => {
          if (packageFile === 'package.json' && configFile === '.npmrc') {
            return Promise.resolve('.npmrc');
          }
          return Promise.resolve(null);
        },
      );
      fs.readLocalFile.mockImplementation((fileName): Promise<any> => {
        if (fileName === '.npmrc') {
          return Promise.resolve('save-exact = true\npackage-lock = false\n');
        }
        return Promise.resolve(null);
      });
      const res = await resolveNpmrc('package.json', {});
      expect(res).toStrictEqual({
        npmrc: 'save-exact = true\n',
        npmrcFileName: '.npmrc',
      });
      expect(logger.debug).toHaveBeenCalledWith(
        'Stripping package-lock setting from .npmrc',
      );
    });

    describe('package-lock sanitization', () => {
      it.each`
        source
        ${'package-lock=false'}
        ${' package-lock = false '}
        ${'package-lock'}
        ${'"package-lock"=false'}
        ${"'package-lock'=false"}
        ${'package-lock # note=false'}
        ${'package-lock ; note=false'}
      `('removes $source', async ({ source }) => {
        const npmrc = await resolveRepoNpmrc(source);

        expect(npmrc).toBe('');
      });

      it.each`
        source
        ${'package-lock[]=false'}
        ${'"package-lock[]"=false'}
        ${'package-lock[] # note=false'}
      `('removes bracketed array $source', async ({ source }) => {
        const npmrc = await resolveRepoNpmrc(source);

        expect(npmrc).toBe('');
      });

      it.each`
        source
        ${'package-lock-other=false'}
        ${'# package-lock=false'}
        ${'; package-lock=false'}
        ${'[package-lock=false]'}
      `('keeps unrelated line $source', async ({ source }) => {
        const npmrc = await resolveRepoNpmrc(source);

        expect(npmrc).toBe(source);
      });

      it('keeps package-lock settings inside a section', async () => {
        const source =
          '[scope]\r\npackage-lock=false\r\npackage-lock[]=true\r\n';

        const npmrc = await resolveRepoNpmrc(source);

        expect(npmrc).toBe(source);
      });
    });

    it('uses config.npmrc if .npmrc does exist but npmrcMerge=false', async () => {
      fs.findLocalSiblingOrParent.mockImplementation(
        (packageFile, configFile): Promise<string | null> => {
          if (packageFile === 'package.json' && configFile === '.npmrc') {
            return Promise.resolve('.npmrc');
          }
          return Promise.resolve(null);
        },
      );
      fs.readLocalFile.mockImplementation((fileName): Promise<any> => {
        if (fileName === '.npmrc') {
          return Promise.resolve('repo-npmrc\n');
        }
        return Promise.resolve(null);
      });
      const res = await resolveNpmrc('package.json', {
        npmrc: 'config-npmrc',
      });
      expect(res).toStrictEqual({
        npmrc: 'config-npmrc',
        npmrcFileName: '.npmrc',
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { npmrcFileName: '.npmrc' },
        'Repo .npmrc file is ignored due to config.npmrc with config.npmrcMerge=false',
      );
    });

    it('uses config.npmrc if no .npmrc file is found', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.findLocalSiblingOrParent.mockResolvedValueOnce(null);
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          name: 'test',
          version: '0.0.1',
          dependencies: { dep1: '1.0.0' },
        }),
      );

      const res = await resolveNpmrc('package.json', {
        npmrc: 'config-npmrc',
      });
      expect(res.npmrc).toBe('config-npmrc');
    });

    describe('npmrcMerge', () => {
      it.each(['\n', '\r\n', '\r'])(
        'does not add a separator after a terminated config using %j',
        async (lineEnding) => {
          const config = `config${lineEnding}`;
          const repo = `repo${lineEnding}`;

          const npmrc = await resolveRepoNpmrc(repo, {
            npmrc: config,
            npmrcMerge: true,
          });

          expect(npmrc).toBe(`${config}${repo}`);
        },
      );

      it.each`
        config               | separator
        ${'first\nconfig'}   | ${'\n'}
        ${'first\r\nconfig'} | ${'\r\n'}
        ${'first\rconfig'}   | ${'\r'}
      `(
        'uses the config document separator for $config',
        async ({ config, separator }) => {
          const npmrc = await resolveRepoNpmrc('repo', {
            npmrc: config,
            npmrcMerge: true,
          });

          expect(npmrc).toBe(`${config}${separator}repo`);
        },
      );

      it.each`
        repo          | separator
        ${'repo\n'}   | ${'\n'}
        ${'repo\r\n'} | ${'\r\n'}
        ${'repo\r'}   | ${'\r'}
      `(
        'uses the repo document separator for $repo',
        async ({ repo, separator }) => {
          const npmrc = await resolveRepoNpmrc(repo, {
            npmrc: 'config',
            npmrcMerge: true,
          });

          expect(npmrc).toBe(`config${separator}${repo}`);
        },
      );

      it('defaults to LF when neither document has a line ending', async () => {
        const npmrc = await resolveRepoNpmrc('repo', {
          npmrc: 'config',
          npmrcMerge: true,
        });

        expect(npmrc).toBe('config\nrepo');
      });

      it.each(['\n', '\r\n', '\r'])(
        'retains the repo separator %j when every repo line is removed',
        async (lineEnding) => {
          const repo = `auth=\${TOKEN}${lineEnding}`;

          const npmrc = await resolveRepoNpmrc(repo, {
            npmrc: 'config',
            npmrcMerge: true,
          });

          expect(npmrc).toBe(`config${lineEnding}`);
        },
      );

      it.each`
        config               | expected
        ${'config'}          | ${'config\n'}
        ${'first\nconfig'}   | ${'first\nconfig\n'}
        ${'first\r\nconfig'} | ${'first\r\nconfig\r\n'}
        ${'first\rconfig'}   | ${'first\rconfig\r'}
      `(
        'terminates config $config when the repo document is empty',
        async ({ config, expected }) => {
          const npmrc = await resolveRepoNpmrc('', {
            npmrc: config,
            npmrcMerge: true,
          });

          expect(npmrc).toBe(expected);
        },
      );
    });

    it('finds and filters .npmrc with variables regardless of assignment spacing', async () => {
      fs.findLocalSiblingOrParent.mockImplementation(
        (packageFile, configFile): Promise<string | null> => {
          if (packageFile === 'package.json' && configFile === '.npmrc') {
            return Promise.resolve('.npmrc');
          }
          return Promise.resolve(null);
        },
      );
      fs.readLocalFile.mockImplementation((fileName): Promise<any> => {
        if (fileName === '.npmrc') {
          return Promise.resolve(
            'registry=https://registry.npmjs.org\n//registry.npmjs.org/:_authToken = ${NPM_AUTH_TOKEN}\n',
          );
        }
        return Promise.resolve(null);
      });

      const res = await resolveNpmrc('package.json', {});

      expect(res).toStrictEqual({
        npmrc: 'registry=https://registry.npmjs.org\n',
        npmrcFileName: '.npmrc',
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { npmrcFileName: '.npmrc' },
        'Stripping .npmrc file of lines with variables',
      );
    });

    describe('environment variable sanitization', () => {
      it.each`
        source
        ${'auth=${TOKEN}'}
        ${'auth = ${TOKEN}'}
        ${'auth=   ${TOKEN}'}
        ${'auth=${TOKEN} # comment'}
      `('removes assignment form $source', async ({ source }) => {
        const npmrc = await resolveRepoNpmrc(source);

        expect(npmrc).toBe('');
      });

      it.each`
        source
        ${'auth="${TOKEN}"'}
        ${"auth='${TOKEN}'"}
        ${'auth=prefix${TOKEN}'}
        ${'auth=${TOKEN}suffix'}
        ${'auth=prefix=${TOKEN}'}
      `('removes embedded expression $source', async ({ source }) => {
        const npmrc = await resolveRepoNpmrc(source);

        expect(npmrc).toBe('');
      });

      it.each`
        source
        ${'auth=${TOKEN?}'}
        ${'auth=$${TOKEN}'}
        ${'auth=\\\\\\${TOKEN}'}
        ${'auth=\\\\\\\\${TOKEN}'}
        ${'${SCOPE}:registry=https://registry.test'}
      `('removes active expression $source', async ({ source }) => {
        const npmrc = await resolveRepoNpmrc(source);

        expect(npmrc).toBe('');
      });

      it.each`
        source
        ${'auth=\\${TOKEN}'}
        ${'auth=\\\\${TOKEN}'}
        ${'auth=${}'}
        ${'auth=${TOKEN??}'}
        ${'auth=${TOKEN'}
      `('keeps inactive expression $source', async ({ source }) => {
        const npmrc = await resolveRepoNpmrc(source);

        expect(npmrc).toBe(source);
      });

      it.each`
        source
        ${'# auth=${TOKEN}'}
        ${'; auth = ${TOKEN}'}
        ${'[auth=${TOKEN}]'}
        ${'auth=value # ${TOKEN}'}
        ${'auth=value ; ${TOKEN}'}
      `(
        'keeps expression npm does not interpolate in $source',
        async ({ source }) => {
          const npmrc = await resolveRepoNpmrc(source);

          expect(npmrc).toBe(source);
        },
      );

      it('removes an environment variable from a bare key', async () => {
        const npmrc = await resolveRepoNpmrc('not-an-assignment ${TOKEN}');

        expect(npmrc).toBe('');
      });

      it('keeps environment variables inside a section', async () => {
        const source =
          '[scope]\r\nauth=${TOKEN}\r\n${KEY}=value\r\n[${SECTION}]\r\n';

        const npmrc = await resolveRepoNpmrc(source);

        expect(npmrc).toBe(source);
      });
    });

    describe('sanitized document line endings', () => {
      it.each(['\n', '\r\n', '\r'])(
        'preserves retained lines using %j',
        async (lineEnding) => {
          const source = [
            'before=true',
            'auth=${TOKEN}',
            'package-lock=false',
            'after=true',
            '',
          ].join(lineEnding);
          const expected = ['before=true', 'after=true', ''].join(lineEnding);

          const npmrc = await resolveRepoNpmrc(source);

          expect(npmrc).toBe(expected);
        },
      );

      it.each`
        source                                              | expected
        ${'auth=${TOKEN}\nkeep=true'}                       | ${'keep=true'}
        ${'keep=true\nauth=${TOKEN}'}                       | ${'keep=true\n'}
        ${'keep=true\nauth=${TOKEN}\n'}                     | ${'keep=true\n'}
        ${'auth=${TOKEN}\npackage-lock=false\nkeep=true'}   | ${'keep=true'}
        ${'keep=true\npackage-lock=false\nauth=${TOKEN}\n'} | ${'keep=true\n'}
      `(
        'preserves line boundaries in $source',
        async ({ source, expected }) => {
          const npmrc = await resolveRepoNpmrc(source);

          expect(npmrc).toBe(expected);
        },
      );

      it('preserves mixed line endings exactly', async () => {
        const source =
          'first=true\r\nauth=${TOKEN}\nsecond=true\rpackage-lock=false\r\nlast=true';

        const npmrc = await resolveRepoNpmrc(source);

        expect(npmrc).toBe('first=true\r\nsecond=true\rlast=true');
      });

      it('preserves blank lines around removed settings', async () => {
        const source = 'first=true\r\n\r\nauth=${TOKEN}\r\n\r\nlast=true\r\n';

        const npmrc = await resolveRepoNpmrc(source);

        expect(npmrc).toBe('first=true\r\n\r\n\r\nlast=true\r\n');
      });
    });

    it('keeps variables when exposeAllEnv is true', async () => {
      GlobalConfig.set({ exposeAllEnv: true });
      fs.findLocalSiblingOrParent.mockImplementation(
        (packageFile, configFile): Promise<string | null> => {
          if (packageFile === 'package.json' && configFile === '.npmrc') {
            return Promise.resolve('.npmrc');
          }
          return Promise.resolve(null);
        },
      );
      fs.readLocalFile.mockImplementation((fileName): Promise<any> => {
        if (fileName === '.npmrc') {
          return Promise.resolve(
            'registry=https://registry.npmjs.org\n//registry.npmjs.org/:_authToken="prefix${NPM_AUTH_TOKEN}"\n',
          );
        }
        return Promise.resolve(null);
      });

      const res = await resolveNpmrc('package.json', {});

      expect(res).toStrictEqual({
        npmrc:
          'registry=https://registry.npmjs.org\n//registry.npmjs.org/:_authToken="prefix${NPM_AUTH_TOKEN}"\n',
        npmrcFileName: '.npmrc',
      });
      expect(logger.debug).not.toHaveBeenCalledWith(
        { npmrcFileName: '.npmrc' },
        'Stripping .npmrc file of lines with variables',
      );
    });
  });
});
