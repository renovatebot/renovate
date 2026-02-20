import { fs } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { logger } from '../../../logger/index.ts';
import { resolveNpmrc } from './npmrc.ts';

vi.mock('../../../util/fs/index.ts');

describe('modules/manager/npm/npmrc', () => {
  describe('resolveNpmrc', () => {
    beforeEach(async () => {
      const realFs = await vi.importActual<typeof fs>('../../../util/fs');
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

    it('merges config.npmrc and repo .npmrc when npmrcMerge=true', async () => {
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
        npmrcMerge: true,
      });
      expect(res).toStrictEqual({
        npmrc: `config-npmrc\nrepo-npmrc\n`,
        npmrcFileName: '.npmrc',
      });
    });

    it('does not add a newline between config.npmrc and repo .npmrc when npmrcMerge is true, if a newline already exists', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
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
          return Promise.resolve('repo-setting=value\n');
        }
        if (fileName === 'package.json') {
          return Promise.resolve(
            JSON.stringify({
              name: 'test',
              version: '0.0.1',
              dependencies: { dep1: '1.0.0' },
            }),
          );
        }
        return Promise.resolve(null);
      });

      const res = await resolveNpmrc('package.json', {
        npmrc: 'config-setting=value\n',
        npmrcMerge: true,
      });
      expect(res.npmrc).toBe('config-setting=value\nrepo-setting=value\n');
    });

    it('finds and filters .npmrc with variables', async () => {
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
            'registry=https://registry.npmjs.org\n//registry.npmjs.org/:_authToken=${NPM_AUTH_TOKEN}\n',
          );
        }
        return Promise.resolve(null);
      });
      const res = await resolveNpmrc('package.json', {});
      expect(res).toStrictEqual({
        npmrc: 'registry=https://registry.npmjs.org\n',
        npmrcFileName: '.npmrc',
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
            'registry=https://registry.npmjs.org\n//registry.npmjs.org/:_authToken=${NPM_AUTH_TOKEN}\n',
          );
        }
        return Promise.resolve(null);
      });
      const res = await resolveNpmrc('package.json', {});
      expect(res).toStrictEqual({
        npmrc:
          'registry=https://registry.npmjs.org\n//registry.npmjs.org/:_authToken=${NPM_AUTH_TOKEN}\n',
        npmrcFileName: '.npmrc',
      });
      GlobalConfig.reset();
    });
  });
});
