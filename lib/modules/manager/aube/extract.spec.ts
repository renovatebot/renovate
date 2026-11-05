import { fs } from '~test/util.ts';
import { stripNpmrc } from '../npm/npmrc.ts';
import { extractAllPackageFiles } from './extract.ts';

vi.mock('../../../util/fs/index.ts');

describe('modules/manager/aube/extract', () => {
  describe('extractAllPackageFiles()', () => {
    it('ignores non-aube files', async () => {
      await expect(
        extractAllPackageFiles({}, ['package.json']),
      ).resolves.toEqual([]);
    });

    it('ignores missing package.json file', async () => {
      await expect(
        extractAllPackageFiles({}, ['aube-lock.yaml']),
      ).resolves.toEqual([]);
    });

    it('ignores invalid package.json file', async () => {
      vi.mocked(fs.readLocalFile).mockResolvedValueOnce('invalid');
      await expect(
        extractAllPackageFiles({}, ['aube-lock.yaml']),
      ).resolves.toEqual([]);
    });

    it('handles null response', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({ _id: 1, _args: 1, _from: 1 }),
      );
      await expect(
        extractAllPackageFiles({}, ['aube-lock.yaml']),
      ).resolves.toEqual([]);
    });

    it('parses valid package.json file', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          name: 'test',
          version: '0.0.1',
          dependencies: { dep1: '1.0.0' },
        }),
      );
      const packageFiles = await extractAllPackageFiles({}, ['aube-lock.yaml']);
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
          lockFiles: ['aube-lock.yaml'],
          managerData: {
            hasPackageManager: false,
            packageJsonName: 'test',
          },
          packageFile: 'package.json',
          packageFileVersion: '0.0.1',
        },
      ]);
    });
  });

  describe('workspaces', () => {
    it('processes workspace package files when workspaces are detected', async () => {
      vi.mocked(fs.getSiblingFileName).mockReturnValue('package.json');
      vi.mocked(fs.readLocalFile)
        .mockResolvedValueOnce(
          JSON.stringify({
            name: 'test',
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
      vi.mocked(fs.getParentDir).mockReturnValueOnce('');

      const packageFiles = await extractAllPackageFiles({}, [
        'aube-lock.yaml',
        'package.json',
        'packages/pkg1/package.json',
      ]);

      expect(packageFiles).toMatchObject([
        {
          packageFile: 'package.json',
          packageFileVersion: '0.0.1',
          lockFiles: ['aube-lock.yaml'],
        },
        {
          packageFile: 'packages/pkg1/package.json',
          packageFileVersion: '1.0.0',
          lockFiles: ['aube-lock.yaml'],
        },
      ]);
    });

    it('skips workspace processing when workspaces is not a valid array', async () => {
      vi.mocked(fs.getSiblingFileName).mockReturnValue('package.json');
      vi.mocked(fs.readLocalFile).mockResolvedValueOnce(
        JSON.stringify({
          name: 'test',
          version: '0.0.1',
          dependencies: { dep1: '1.0.0' },
          workspaces: 'invalid',
        }),
      );

      const packageFiles = await extractAllPackageFiles({}, [
        'aube-lock.yaml',
        'package.json',
        'packages/pkg1/package.json',
      ]);

      expect(packageFiles).toMatchObject([
        {
          packageFile: 'package.json',
          packageFileVersion: '0.0.1',
          lockFiles: ['aube-lock.yaml'],
        },
      ]);
    });

    it('skips workspace processing when workspaces is null', async () => {
      vi.mocked(fs.getSiblingFileName).mockReturnValue('package.json');
      vi.mocked(fs.readLocalFile).mockResolvedValueOnce(
        JSON.stringify({
          name: 'test',
          version: '0.0.1',
          dependencies: { dep1: '1.0.0' },
          workspaces: null,
        }),
      );

      const packageFiles = await extractAllPackageFiles({}, [
        'aube-lock.yaml',
        'package.json',
        'packages/pkg1/package.json',
      ]);

      expect(packageFiles).toMatchObject([
        {
          packageFile: 'package.json',
          packageFileVersion: '0.0.1',
          lockFiles: ['aube-lock.yaml'],
        },
      ]);
    });

    it('handles workspaces with no matching package files', async () => {
      vi.mocked(fs.getSiblingFileName).mockReturnValue('package.json');
      vi.mocked(fs.readLocalFile).mockResolvedValueOnce(
        JSON.stringify({
          name: 'test',
          version: '0.0.1',
          dependencies: { dep1: '1.0.0' },
          workspaces: ['packages/*'],
        }),
      );
      vi.mocked(fs.getParentDir).mockReturnValueOnce('');

      const packageFiles = await extractAllPackageFiles({}, [
        'aube-lock.yaml',
        'package.json',
      ]);

      expect(packageFiles).toMatchObject([
        {
          packageFile: 'package.json',
          packageFileVersion: '0.0.1',
          lockFiles: ['aube-lock.yaml'],
        },
      ]);
    });

    it('skips workspace package files that return no result', async () => {
      vi.mocked(fs.getSiblingFileName).mockReturnValue('package.json');
      vi.mocked(fs.readLocalFile)
        .mockResolvedValueOnce(
          JSON.stringify({
            name: 'test',
            version: '0.0.1',
            dependencies: { dep1: '1.0.0' },
            workspaces: ['packages/*'],
          }),
        )
        .mockResolvedValueOnce('invalid');
      vi.mocked(fs.getParentDir).mockReturnValueOnce('');

      const packageFiles = await extractAllPackageFiles({}, [
        'aube-lock.yaml',
        'package.json',
        'packages/pkg1/package.json',
      ]);

      expect(packageFiles).toMatchObject([
        {
          packageFile: 'package.json',
          packageFileVersion: '0.0.1',
          lockFiles: ['aube-lock.yaml'],
        },
      ]);
    });

    it('processes workspaces given as object with packages property', async () => {
      vi.mocked(fs.getSiblingFileName).mockReturnValue('package.json');
      vi.mocked(fs.readLocalFile)
        .mockResolvedValueOnce(
          JSON.stringify({
            name: 'my-monorepo',
            version: '0.0.1',
            dependencies: { dep1: '1.0.0' },
            workspaces: { packages: ['packages/*'] },
          }),
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            name: 'pkg1',
            version: '1.0.0',
            dependencies: { dep2: '2.0.0' },
          }),
        );
      vi.mocked(fs.getParentDir).mockReturnValueOnce('');

      const packageFiles = await extractAllPackageFiles({}, [
        'aube-lock.yaml',
        'package.json',
        'packages/pkg1/package.json',
      ]);

      expect(packageFiles).toMatchObject([
        { packageFile: 'package.json', lockFiles: ['aube-lock.yaml'] },
        {
          packageFile: 'packages/pkg1/package.json',
          lockFiles: ['aube-lock.yaml'],
        },
      ]);
    });
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

    const packageFiles = await extractAllPackageFiles({}, ['aube-lock.yaml']);
    expect(packageFiles).toHaveLength(1);
    expect(packageFiles[0].npmrc).toBe(
      'registry=https://custom.registry.com\n',
    );
    expect(packageFiles[0].managerData?.repoNpmrc).toMatchObject({
      fileName: '.npmrc',
      content: 'registry=https://custom.registry.com\n',
    });
    expect(packageFiles[0].managerData?.npmrcFileName).toBe('.npmrc');
  });

  it('marks an unreadable repository .npmrc to be read from disk again', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('package.json');
    fs.findLocalSiblingOrParent.mockResolvedValue('.npmrc');
    fs.readLocalFile
      .mockResolvedValueOnce(
        JSON.stringify({ name: 'test', dependencies: { dep1: '1.0.0' } }),
      )
      .mockResolvedValueOnce(null);

    const packageFiles = await extractAllPackageFiles({}, ['aube-lock.yaml']);

    expect(packageFiles[0]).not.toHaveProperty('npmrc');
    expect(stripNpmrc(packageFiles)[0].managerData).toMatchObject({
      npmrcFileName: '.npmrc',
      uncachedNpmrcFileName: '.npmrc',
    });
  });

  it('does not store a repository .npmrc when there is none', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('package.json');
    fs.findLocalSiblingOrParent.mockResolvedValue(null);
    fs.readLocalFile.mockResolvedValueOnce(
      JSON.stringify({ name: 'test', dependencies: { dep1: '1.0.0' } }),
    );

    const packageFiles = await extractAllPackageFiles({}, ['aube-lock.yaml']);

    expect(packageFiles).toHaveLength(1);
    expect(packageFiles[0]).not.toHaveProperty('npmrc');
    expect(packageFiles[0].managerData).not.toHaveProperty('repoNpmrc');
  });
});
