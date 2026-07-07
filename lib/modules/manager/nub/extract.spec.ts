import { fs } from '~test/util.ts';
import { extractAllPackageFiles } from './extract.ts';

vi.mock('../../../util/fs/index.ts');

describe('modules/manager/nub/extract', () => {
  describe('extractAllPackageFiles()', () => {
    it('ignores non-nub files', async () => {
      expect(await extractAllPackageFiles({}, ['package.json'])).toEqual([]);
    });

    it('ignores missing package.json file', async () => {
      expect(await extractAllPackageFiles({}, ['nub.lock'])).toEqual([]);
    });

    it('ignores invalid package.json file', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce('invalid');
      expect(await extractAllPackageFiles({}, ['nub.lock'])).toEqual([]);
    });

    it('handles null response', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce(
        // This package.json returns null from the extractor
        JSON.stringify({
          _id: 1,
          _args: 1,
          _from: 1,
        }),
      );
      expect(await extractAllPackageFiles({}, ['nub.lock'])).toEqual([]);
    });

    it('parses valid package.json file', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          name: 'test',
          version: '0.0.1',
          dependencies: {
            dep1: '1.0.0',
          },
        }),
      );
      const packageFiles = await extractAllPackageFiles({}, ['nub.lock']);
      expect(packageFiles).toMatchObject([
        {
          deps: [
            {
              currentValue: '1.0.0',
              datasource: 'npm',
              depName: 'dep1',
              depType: 'dependencies',
              prettyDepType: 'dependency',
            },
          ],
          extractedConstraints: {},
          lockFiles: ['nub.lock'],
          managerData: {
            hasPackageManager: false,
            packageJsonName: 'test',
          },
          packageFile: 'package.json',
          packageFileVersion: '0.0.1',
        },
      ]);
    });

    it('processes workspace package files', async () => {
      fs.getSiblingFileName.mockReturnValue('package.json');
      fs.readLocalFile
        .mockResolvedValueOnce(
          JSON.stringify({
            name: 'my-monorepo',
            version: '0.0.1',
            dependencies: { dep1: '1.0.0' },
            workspaces: ['packages/*'],
          }),
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            name: 'pkg1',
            version: '1.0.0',
            dependencies: { dep2: '2.0.0' },
          }),
        );
      fs.getParentDir.mockReturnValueOnce('');

      const packageFiles = await extractAllPackageFiles({}, [
        'nub.lock',
        'package.json',
        'packages/pkg1/package.json',
      ]);

      expect(packageFiles).toMatchObject([
        {
          packageFile: 'package.json',
          packageFileVersion: '0.0.1',
          lockFiles: ['nub.lock'],
        },
        {
          packageFile: 'packages/pkg1/package.json',
          packageFileVersion: '1.0.0',
          lockFiles: ['nub.lock'],
        },
      ]);
    });

    it('handles workspaces with no matching package files', async () => {
      fs.getSiblingFileName.mockReturnValue('package.json');
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          name: 'my-monorepo',
          version: '0.0.1',
          dependencies: { dep1: '1.0.0' },
          workspaces: ['packages/*'],
        }),
      );
      fs.getParentDir.mockReturnValueOnce('');

      // No sibling package.json files match the workspace globs.
      const packageFiles = await extractAllPackageFiles({}, [
        'nub.lock',
        'package.json',
      ]);

      expect(packageFiles).toMatchObject([
        {
          packageFile: 'package.json',
          packageFileVersion: '0.0.1',
          lockFiles: ['nub.lock'],
        },
      ]);
    });

    it('skips unreadable workspace package files', async () => {
      fs.getSiblingFileName.mockReturnValue('package.json');
      fs.readLocalFile
        .mockResolvedValueOnce(
          JSON.stringify({
            name: 'my-monorepo',
            version: '0.0.1',
            dependencies: { dep1: '1.0.0' },
            workspaces: ['packages/*'],
          }),
        )
        // workspace package file is unreadable → filtered out
        .mockResolvedValueOnce(null);
      fs.getParentDir.mockReturnValueOnce('');

      const packageFiles = await extractAllPackageFiles({}, [
        'nub.lock',
        'package.json',
        'packages/pkg1/package.json',
      ]);

      expect(packageFiles).toMatchObject([
        {
          packageFile: 'package.json',
          packageFileVersion: '0.0.1',
          lockFiles: ['nub.lock'],
        },
      ]);
    });

    it('skips workspace processing when workspaces is not a valid array', async () => {
      fs.getSiblingFileName.mockReturnValue('package.json');
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          name: 'test',
          version: '0.0.1',
          dependencies: { dep1: '1.0.0' },
          workspaces: 'invalid',
        }),
      );

      const packageFiles = await extractAllPackageFiles({}, [
        'nub.lock',
        'package.json',
        'packages/pkg1/package.json',
      ]);

      expect(packageFiles).toMatchObject([
        {
          packageFile: 'package.json',
          packageFileVersion: '0.0.1',
          lockFiles: ['nub.lock'],
        },
      ]);
    });

    it('extracts .npmrc from sibling or parent directory', async () => {
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
          return Promise.resolve('registry=https://custom.registry.com\n');
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

      const packageFiles = await extractAllPackageFiles({}, ['nub.lock']);
      expect(packageFiles).toHaveLength(1);
      expect(packageFiles[0].npmrc).toBe(
        'registry=https://custom.registry.com\n',
      );
    });
  });
});
