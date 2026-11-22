import { fs } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { logger } from '../../../logger/index.ts';
import type { NpmrcPackageFile } from '../types.ts';
import {
  applyConfigNpmrc,
  hasNpmrcCredentials,
  hasUncachedNpmrc,
  resolveNpmrc,
  restoreNpmrc,
  stripNpmrc,
} from './npmrc.ts';
import type { NpmManagerData } from './types.ts';

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

    it('returns undefined if the discovered .npmrc cannot be read', async () => {
      fs.findLocalSiblingOrParent.mockResolvedValue('.npmrc');

      const res = await resolveNpmrc('package.json', {});

      expect(res).toStrictEqual({
        npmrc: undefined,
        npmrcFileName: '.npmrc',
      });
    });

    it('returns undefined next to config.npmrc if the discovered .npmrc cannot be read', async () => {
      fs.findLocalSiblingOrParent.mockResolvedValue('.npmrc');

      const res = await resolveNpmrc('package.json', {
        npmrc: 'config-npmrc',
      });

      expect(res).toStrictEqual({
        npmrc: undefined,
        npmrcFileName: '.npmrc',
      });
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
        repoNpmrc: {
          fileName: '.npmrc',
          content: 'save-exact = true\n',
          detectedLineEnding: '\n',
        },
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
      expect(logger.info).toHaveBeenCalledWith(
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
        repoNpmrc: {
          fileName: '.npmrc',
          content: 'registry=https://registry.npmjs.org\n',
          detectedLineEnding: '\n',
        },
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { npmrcFileName: '.npmrc' },
        'Stripping .npmrc file of lines with variables',
      );
    });

    describe('environment variable reference sanitization', () => {
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
        ${"auth='prefix${TOKEN}'"}
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
        ${'${SCOPE}:registry=https://registry.test'}
        ${'auth="${TOKEN NAME}"'}
        ${'auth=${FIRST}-${SECOND?}'}
        ${'auth=value \\# ${TOKEN}'}
        ${'auth=value \\; ${TOKEN}'}
        ${'auth=${BAD${GOOD}}'}
      `('removes active environment expression $source', async ({ source }) => {
        const npmrc = await resolveRepoNpmrc(source);

        expect(npmrc).toBe('');
      });

      it.each`
        source
        ${'auth=${}'}
        ${'auth=${TOKEN??}'}
        ${'auth=${TOKEN'}
        ${'auth=${TO$KEN}'}
        ${'auth=${TO{KEN}'}
      `('keeps inactive environment expression $source', async ({ source }) => {
        const npmrc = await resolveRepoNpmrc(source);

        expect(npmrc).toBe(source);
      });

      it.each`
        rawEscapeCount | removed
        ${1}           | ${false}
        ${2}           | ${false}
        ${3}           | ${true}
        ${4}           | ${true}
        ${5}           | ${false}
        ${6}           | ${false}
      `(
        'handles $rawEscapeCount unquoted escapes',
        async ({ rawEscapeCount, removed }) => {
          const source = `auth=${'\\'.repeat(rawEscapeCount)}${'${TOKEN}'}`;
          const npmrc = await resolveRepoNpmrc(source);

          expect(npmrc).toBe(removed ? '' : source);
        },
      );

      it.each`
        decodedEscapeCount | removed
        ${1}               | ${false}
        ${2}               | ${true}
      `(
        'handles $decodedEscapeCount quoted escapes',
        async ({ decodedEscapeCount, removed }) => {
          const value = `${'\\'.repeat(decodedEscapeCount)}${'${TOKEN}'}`;
          const source = `auth=${JSON.stringify(value)}`;
          const npmrc = await resolveRepoNpmrc(source);

          expect(npmrc).toBe(removed ? '' : source);
        },
      );

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

      it('removes a bare key containing an environment variable reference', async () => {
        const npmrc = await resolveRepoNpmrc('not-an-assignment ${TOKEN}');

        expect(npmrc).toBe('');
      });

      it('keeps environment variable references inside an npm section', async () => {
        const source =
          '[scope]\r\nauth=${TOKEN}\r\n${KEY}=value\r\n[${SECTION}]\r\n';

        const npmrc = await resolveRepoNpmrc(source);

        expect(npmrc).toBe(source);
      });

      it.each([' ', '\t', '\uFEFF'])(
        'removes top-level settings after a section-like line prefixed with %j',
        async (prefix) => {
          const sectionLine = `${prefix}[scope]\n`;
          const npmrc = await resolveRepoNpmrc(
            `${sectionLine}auth = \${TOKEN}\npackage-lock=false\n`,
          );

          expect(npmrc).toBe(sectionLine);
        },
      );

      it('removes an environment variable reference from a section-like setting', async () => {
        const npmrc = await resolveRepoNpmrc(' [${SECTION}]\n');

        expect(npmrc).toBe('');
      });

      it("keeps npm's current section after a section-like setting", async () => {
        const source =
          '[recognized]\n [parser-only]\nauth=${TOKEN}\npackage-lock=false\n';

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
        repoNpmrc: {
          fileName: '.npmrc',
          content:
            'registry=https://registry.npmjs.org\n//registry.npmjs.org/:_authToken="prefix${NPM_AUTH_TOKEN}"\n',
          detectedLineEnding: '\n',
        },
      });
      expect(logger.debug).not.toHaveBeenCalledWith(
        { npmrcFileName: '.npmrc' },
        'Stripping .npmrc file of lines with variables',
      );
    });
  });

  describe('applyConfigNpmrc', () => {
    const repoNpmrc = {
      fileName: '.npmrc',
      content: 'registry=https://reg.example.com/\n',
      detectedLineEnding: '\n' as const,
    };

    it('returns the config npmrc when there is no repo npmrc', () => {
      expect(applyConfigNpmrc({}, undefined)).toBeUndefined();
      expect(applyConfigNpmrc({ npmrc: 'config' }, undefined)).toBe('config');
    });

    it('returns the repo npmrc when there is no config npmrc', () => {
      expect(applyConfigNpmrc({}, repoNpmrc)).toBe(repoNpmrc.content);
    });

    it('merges both when npmrcMerge is set', () => {
      expect(
        applyConfigNpmrc({ npmrc: 'config', npmrcMerge: true }, repoNpmrc),
      ).toBe(`config\n${repoNpmrc.content}`);
    });

    it('ignores the repo npmrc when npmrcMerge is not set', () => {
      expect(applyConfigNpmrc({ npmrc: 'config' }, repoNpmrc)).toBe('config');
      expect(logger.info).toHaveBeenCalledWith(
        { npmrcFileName: '.npmrc' },
        'Repo .npmrc file is ignored due to config.npmrc with config.npmrcMerge=false',
      );
    });
  });

  describe('hasNpmrcCredentials', () => {
    it.each`
      content                                                            | expected
      ${'registry=https://reg.example.com/'}                             | ${false}
      ${'@scope:registry=https://reg.example.com/'}                      | ${false}
      ${'//reg.example.com/:always-auth=true'}                           | ${false}
      ${'//reg.example.com/:_authToken=abc'}                             | ${true}
      ${'//reg.example.com/:_auth=abc'}                                  | ${true}
      ${'//reg.example.com/:_password=abc'}                              | ${true}
      ${'_authToken=abc'}                                                | ${true}
      ${'registry=https://user:pass@reg.example.com/'}                   | ${true}
      ${'registry=https://npm_0123456789abcdef@reg.example.com/'}        | ${true}
      ${'registry=https://token@reg.example.com/'}                       | ${false}
      ${'//reg.example.com/:_authToken=${NPM_TOKEN}'}                    | ${false}
      ${'//reg.example.com/:_authToken="${NPM_TOKEN}"'}                  | ${false}
      ${'//reg.example.com/:_authToken = ${NPM_TOKEN} '}                 | ${false}
      ${'_auth="prefix${NPM_AUTH}"'}                                     | ${true}
      ${'//npm.corp/:_authToken=npm_abc123${SUFFIX}'}                    | ${true}
      ${'//reg.example.com/:_authToken=${NPM_TOKEN}x'}                   | ${true}
      ${'//reg.example.com/:_authToken=${A}${B}'}                        | ${true}
      ${'//reg.example.com/:_authToken=npm_abc123'}                      | ${true}
      ${'registry=${REGISTRY}'}                                          | ${false}
      ${'registry=https://user:${PASS}@reg.example.com/'}                | ${false}
      ${'registry=https://${USER}:${PASS}@reg.example.com/'}             | ${false}
      ${'registry=https://user:pre${PASS}@reg.example.com/'}             | ${true}
      ${'registry=https://${TOKEN}@reg.example.com/'}                    | ${false}
      ${'@scope:registry=https://${TOKEN}@reg.example.com/'}             | ${false}
      ${'@scope:registry=https://npm_0123456789abcdef@reg.example.com/'} | ${true}
      ${'# _authToken=abc'}                                              | ${false}
      ${'//reg.example.com/:_AUTHTOKEN=abc'}                             | ${true}
      ${'//${HOST}/:_authToken=abc'}                                     | ${true}
      ${'registry=//user:pass@reg.example.com/'}                         | ${true}
      ${'key=-----BEGIN PRIVATE KEY-----'}                               | ${true}
      ${'//reg.example.com/:key=-----BEGIN PRIVATE KEY-----'}            | ${true}
      ${'cert=-----BEGIN CERTIFICATE-----'}                              | ${false}
      ${'keyfile=~/.npm/key.pem'}                                        | ${false}
      ${'//user:s3cr3t@npm.example.com/:always-auth=true'}               | ${true}
      ${'//user:s3cr3t@npm.example.com/:_authToken=${NPM_TOKEN}'}        | ${true}
      ${'https://user:s3cr3t@npm.example.com/:always-auth=true'}         | ${true}
      ${'//npm.example.com/:_authToken=${NPM_TOKEN}'}                    | ${false}
      ${'//${USER}:${PASS}@npm.example.com/:always-auth=true'}           | ${false}
      ${'//npm.example.com:8443/:always-auth=true'}                      | ${false}
    `('returns $expected for $content', ({ content, expected }) => {
      expect(
        hasNpmrcCredentials({
          fileName: '.npmrc',
          content,
          detectedLineEnding: null,
        }),
      ).toBe(expected);
    });
  });

  describe('package file helpers', () => {
    const repoNpmrc = {
      fileName: '.npmrc',
      content: 'registry=https://reg.example.com/\n',
      detectedLineEnding: '\n' as const,
    };
    const withRepoNpmrc: NpmrcPackageFile<NpmManagerData> = {
      packageFile: 'package.json',
      npmrc: 'merged',
      managerData: { npmrcFileName: '.npmrc', repoNpmrc },
      deps: [],
    };
    const withoutRepoNpmrc: NpmrcPackageFile<NpmManagerData> = {
      packageFile: 'other/package.json',
      npmrc: 'config',
      managerData: { npmrcFileName: null },
      deps: [],
    };
    const withCredentials: NpmrcPackageFile<NpmManagerData> = {
      packageFile: 'private/package.json',
      npmrc: '//reg.example.com/:_authToken=abc\n',
      managerData: {
        npmrcFileName: 'private/.npmrc',
        repoNpmrc: {
          fileName: 'private/.npmrc',
          content: '//reg.example.com/:_authToken=abc\n',
          detectedLineEnding: '\n',
        },
      },
      deps: [],
    };

    it('stripNpmrc removes the npmrc from copies', () => {
      expect(stripNpmrc([withRepoNpmrc, withoutRepoNpmrc])).toEqual([
        {
          packageFile: 'package.json',
          managerData: { npmrcFileName: '.npmrc', repoNpmrc },
          deps: [],
        },
        {
          packageFile: 'other/package.json',
          managerData: { npmrcFileName: null },
          deps: [],
        },
      ]);
      expect(withRepoNpmrc.npmrc).toBe('merged');
    });

    it('stripNpmrc drops a repository npmrc with credentials and marks the copy', () => {
      const stripped = {
        packageFile: 'private/package.json',
        managerData: {
          npmrcFileName: 'private/.npmrc',
          uncachedNpmrcFileName: 'private/.npmrc',
        },
        deps: [],
      };

      // the same `.npmrc` of two workspaces is classified once
      expect(stripNpmrc([withCredentials, withCredentials])).toEqual([
        stripped,
        stripped,
      ]);
      expect(withCredentials.managerData?.repoNpmrc).toBeDefined();
      expect(logger.once.warn).toHaveBeenCalledWith(
        { npmrcFileName: 'private/.npmrc' },
        'A repository .npmrc contains credentials, which are not cached: configure them through hostRules or the npmrc option instead',
      );
    });

    it('restoreNpmrc rebuilds the npmrc on copies', async () => {
      const stripped = stripNpmrc([withRepoNpmrc, withoutRepoNpmrc]);

      const [first, second] = await restoreNpmrc(stripped, {
        npmrc: 'config',
        npmrcMerge: true,
      });

      expect(first.npmrc).toBe(`config\n${repoNpmrc.content}`);
      expect(second.npmrc).toBe('config');
      expect(stripped[0].npmrc).toBeUndefined();
      expect(fs.readLocalFile).not.toHaveBeenCalled();
    });

    it('restoreNpmrc reads a marked npmrc from disk again', async () => {
      const stripped = stripNpmrc([withCredentials, withCredentials]);
      fs.readLocalFile.mockResolvedValueOnce(
        '//reg.example.com/:_authToken=abc\n',
      );

      const [restored, workspace] = await restoreNpmrc(stripped, {
        npmrc: 'config',
        npmrcMerge: true,
      });

      expect(restored.npmrc).toBe(
        'config\n//reg.example.com/:_authToken=abc\n',
      );
      expect(restored.managerData?.uncachedNpmrcFileName).toBe(
        'private/.npmrc',
      );
      // the same `.npmrc` of two workspaces is read once
      expect(workspace.npmrc).toBe(restored.npmrc);
      expect(fs.readLocalFile).toHaveBeenCalledExactlyOnceWith(
        'private/.npmrc',
        'utf8',
      );
      expect(fs.findLocalSiblingOrParent).not.toHaveBeenCalled();
    });

    it('stripNpmrc marks a copy with an npmrcFileName but without npmrc to be read from disk again', () => {
      const unreadable: NpmrcPackageFile<NpmManagerData> = {
        packageFile: 'package.json',
        managerData: { npmrcFileName: '.npmrc' },
        deps: [],
      };
      const withoutNpmrc: NpmrcPackageFile<NpmManagerData> = {
        packageFile: 'other/package.json',
        managerData: { npmrcFileName: null },
        deps: [],
      };

      expect(stripNpmrc([unreadable, withoutNpmrc])).toEqual([
        {
          packageFile: 'package.json',
          managerData: {
            npmrcFileName: '.npmrc',
            uncachedNpmrcFileName: '.npmrc',
          },
          deps: [],
        },
        withoutNpmrc,
      ]);
      expect(unreadable.managerData).toEqual({ npmrcFileName: '.npmrc' });
      expect(logger.once.warn).not.toHaveBeenCalled();
    });

    it('restoreNpmrc restores the npmrc of an unreadable .npmrc as a fresh extract', async () => {
      const config = { npmrc: 'config' };
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('.npmrc');
      fs.readLocalFile.mockResolvedValue(null);
      const { npmrc, npmrcFileName } = await resolveNpmrc(
        'package.json',
        config,
      );
      const extracted: NpmrcPackageFile<NpmManagerData> = {
        packageFile: 'package.json',
        npmrc,
        managerData: { npmrcFileName },
        deps: [],
      };

      const [restored] = await restoreNpmrc(stripNpmrc([extracted]), config);

      expect(npmrc).toBeUndefined();
      expect(restored).not.toHaveProperty('npmrc');
      expect(fs.readLocalFile).toHaveBeenNthCalledWith(2, '.npmrc', 'utf8');
    });

    it('restoreNpmrc leaves the npmrc of a marked npmrc unset once it cannot be read', async () => {
      const stripped = stripNpmrc([withCredentials]);
      fs.readLocalFile.mockResolvedValueOnce(null);

      const [restored] = await restoreNpmrc(stripped, { npmrc: 'config' });

      expect(restored).not.toHaveProperty('npmrc');
    });

    it('restoreNpmrc leaves the package files extracted without npmrc without one', async () => {
      const pnpmWorkspace: NpmrcPackageFile<NpmManagerData> = {
        packageFile: 'pnpm-workspace.yaml',
        deps: [],
      };
      const yarnrc: NpmrcPackageFile<NpmManagerData> = {
        packageFile: '.yarnrc.yml',
        managerData: { yarnZeroInstall: false },
        deps: [],
      };
      const extracted = [withRepoNpmrc, pnpmWorkspace, yarnrc];
      const config = { npmrc: 'config', npmrcMerge: true };

      const restored = await restoreNpmrc(stripNpmrc(extracted), config);

      expect(restored).toEqual([
        { ...withRepoNpmrc, npmrc: `config\n${repoNpmrc.content}` },
        pnpmWorkspace,
        yarnrc,
      ]);
      expect(restored[1]).not.toHaveProperty('npmrc');
      expect(restored[2]).not.toHaveProperty('npmrc');
      // as the repository cache stores them
      const cached = JSON.parse(JSON.stringify(stripNpmrc(extracted)));
      await expect(restoreNpmrc(cached, config)).resolves.toEqual(restored);
    });

    it.each`
      description                     | line
      ${'a whole-line comment'}       | ${'# //reg.example.com/:_authToken=npm_0123456789abcdef'}
      ${'a semicolon comment'}        | ${'; //reg.example.com/:_authToken=npm_0123456789abcdef'}
      ${'an inline comment'}          | ${'registry=https://reg.example.com/ # old: npm_0123456789abcdef'}
      ${'a line which is no setting'} | ${'=npm_0123456789abcdef'}
    `(
      'stripNpmrc does not cache a repository npmrc with $description',
      async ({ line }) => {
        const content = `${line}\n\nregistry=https://reg.example.com/\n`;
        const config = { npmrc: 'config', npmrcMerge: true };
        mockRepoNpmrc(content);
        const { npmrc, npmrcFileName, repoNpmrc } = await resolveNpmrc(
          'package.json',
          config,
        );
        const extracted: NpmrcPackageFile<NpmManagerData> = {
          packageFile: 'package.json',
          npmrc,
          managerData: { npmrcFileName, repoNpmrc },
          deps: [],
        };

        const stripped = stripNpmrc([extracted]);
        const [restored] = await restoreNpmrc(stripped, config);

        expect(stripped).toEqual([
          {
            packageFile: 'package.json',
            managerData: {
              npmrcFileName: '.npmrc',
              uncachedNpmrcFileName: '.npmrc',
            },
            deps: [],
          },
        ]);
        expect(JSON.stringify(stripped)).not.toContain('npm_0123456789abcdef');
        // read from disk again on a cached run
        expect(restored.npmrc).toBe(npmrc);
        expect(logger.once.debug).toHaveBeenCalledWith(
          { npmrcFileName: '.npmrc' },
          'A repository .npmrc contains comments or lines which are not settings, so it is not cached',
        );
        expect(logger.once.warn).not.toHaveBeenCalled();
      },
    );

    it('stripNpmrc caches a repository npmrc with settings and sections only verbatim', async () => {
      const content =
        'registry=https://reg.example.com/\n\n[scope]\nalways-auth=true\n';
      mockRepoNpmrc(content);
      const { npmrc, npmrcFileName, repoNpmrc } = await resolveNpmrc(
        'package.json',
        {},
      );

      const [stripped] = stripNpmrc([
        {
          packageFile: 'package.json',
          npmrc,
          managerData: { npmrcFileName, repoNpmrc },
          deps: [],
        },
      ]);

      expect(stripped.managerData).toEqual({
        npmrcFileName: '.npmrc',
        repoNpmrc: {
          fileName: '.npmrc',
          content,
          detectedLineEnding: '\n',
        },
      });
    });

    it('hasUncachedNpmrc finds a marked package file', () => {
      expect(hasUncachedNpmrc([withRepoNpmrc, withoutRepoNpmrc])).toBeFalse();
      expect(
        hasUncachedNpmrc([withoutRepoNpmrc, ...stripNpmrc([withCredentials])]),
      ).toBeTrue();
    });

    it('restoreNpmrc restores the config npmrc of a package file whose repository npmrc is ignored', async () => {
      const config = { npmrc: 'config' };
      mockRepoNpmrc(repoNpmrc.content);
      const { npmrc, npmrcFileName } = await resolveNpmrc(
        'package.json',
        config,
      );
      const extracted: NpmrcPackageFile<NpmManagerData> = {
        packageFile: 'package.json',
        npmrc,
        managerData: { npmrcFileName },
        deps: [],
      };
      const stripped = stripNpmrc([extracted]);
      fs.readLocalFile.mockClear();

      const [restored] = await restoreNpmrc(stripped, config);

      expect(stripped).toEqual([
        {
          packageFile: 'package.json',
          managerData: { npmrcFileName: '.npmrc' },
          deps: [],
        },
      ]);
      expect(restored.npmrc).toBe('config');
      expect(hasUncachedNpmrc(stripped)).toBeFalse();
      expect(fs.readLocalFile).not.toHaveBeenCalled();
    });
  });
});
