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
