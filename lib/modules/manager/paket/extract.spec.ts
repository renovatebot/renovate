import { beforeEach, describe } from 'vitest';
import { fs, git } from '~test/util.ts';
import { NugetDatasource } from '../../datasource/nuget/index.ts';
import type { ExtractConfig } from '../types.ts';
import { extractPackageFile } from './extract.ts';

vi.mock('../../../util/fs');

describe('modules/manager/paket/extract', () => {
  const packageFileName = '/app/test/paket.dependencies';

  function initializeMock() {
    fs.getSiblingFileName.mockImplementation(
      (fileName: string, siblingName: string) => {
        expect(fileName).equals(packageFileName);
        expect(siblingName).equals('paket.lock');
        return '/app/test/paket.lock';
      },
    );
  }
  beforeEach(() => {
    initializeMock();
  });

  describe('extractPackageFile()', () => {
    const config: ExtractConfig = {};
    const packageFileContent = `
source https://api.nuget.org/v3/index.json

nuget Fsharp.Core
nuget xunit

group GroupA
  source https://api.nuget.org/v3/index.json
  nuget Fake
  nuget xunit
`;
    const lockFileName = '/app/test/paket.lock';
    const lockFileContent = `
NUGET
  remote: https://api.nuget.org/v3/index.json
    FSharp.Core (9.0.300)
    xunit (2.9.3)
GROUP GroupA
NUGET
  remote: https://api.nuget.org/v3/index.json
    FAKE (5.16)
    xunit (2.9.2)
`;

    it('return all packages', async () => {
      git.getFiles.mockResolvedValueOnce({
        [lockFileName]: lockFileContent,
      });

      const result = await extractPackageFile(
        packageFileContent,
        packageFileName,
        config,
      );

      expect(result).toEqual({
        deps: [
          {
            depType: 'dependencies',
            depName: 'FSharp.Core',
            currentVersion: '9.0.300',
            datasource: NugetDatasource.id,
            rangeStrategy: 'update-lockfile',
            lockedVersion: '9.0.300',
          },
          {
            depType: 'dependencies',
            depName: 'xunit',
            currentVersion: '2.9.3',
            datasource: NugetDatasource.id,
            rangeStrategy: 'update-lockfile',
            lockedVersion: '2.9.3',
          },
          {
            depType: 'dependencies',
            depName: 'FAKE',
            currentVersion: '5.16',
            datasource: NugetDatasource.id,
            rangeStrategy: 'update-lockfile',
            lockedVersion: '5.16',
          },
          {
            depType: 'dependencies',
            depName: 'xunit',
            currentVersion: '2.9.2',
            datasource: NugetDatasource.id,
            rangeStrategy: 'update-lockfile',
            lockedVersion: '2.9.2',
          },
        ],
        lockFiles: [lockFileName],
      });
    });

    it('throw error if not found lock file', async () => {
      git.getFiles.mockResolvedValueOnce({});

      const result = extractPackageFile(
        packageFileContent,
        packageFileName,
        config,
      );

      await expect(result).rejects.toThrowError();
    });

    it('return package name of dependencies file if unknown in lock file', async () => {
      git.getFiles.mockResolvedValueOnce({
        [lockFileName]: `
NUGET
  remote: https://api.nuget.org/v3/index.json
    FSharp.Core (9.0.300)
`,
      });
      const packageFileContent = `
source https://api.nuget.org/v3/index.json

nuget Fsharp.Core
nuget xunit
`;

      const result = await extractPackageFile(
        packageFileContent,
        packageFileName,
        config,
      );

      expect(result).toEqual({
        deps: [
          {
            depType: 'dependencies',
            depName: 'FSharp.Core',
            currentVersion: '9.0.300',
            datasource: NugetDatasource.id,
            rangeStrategy: 'update-lockfile',
            lockedVersion: '9.0.300',
          },
          {
            depType: 'dependencies',
            depName: 'xunit',
            datasource: NugetDatasource.id,
            rangeStrategy: 'update-lockfile',
          },
        ],
        lockFiles: [lockFileName],
      });
    });
  });
});
