import { codeBlock } from 'common-tags';
import { fs } from '~test/util.ts';
import { NugetDatasource } from '../../datasource/nuget/index.ts';
import type { ExtractConfig } from '../types.ts';
import { extractPackageFile } from './extract.ts';

vi.mock('../../../util/fs/index.ts');

describe('modules/manager/paket/extract', () => {
  const packageFileName = '/app/test/paket.dependencies';

  beforeEach(() => {
    fs.getSiblingFileName.mockImplementation(
      (fileName: string, siblingName: string) => {
        if (fileName !== packageFileName) {
          throw new Error(`Not expected fileName: ${fileName}`);
        }
        if (siblingName !== 'paket.lock') {
          throw new Error(`Not expected siblingName: ${siblingName}`);
        }
        return '/app/test/paket.lock';
      },
    );
  });

  describe('extractPackageFile()', () => {
    const config: ExtractConfig = {};
    const packageFileContent = codeBlock`
      source https://api.nuget.org/v3/index.json

      nuget Fsharp.Core
      nuget xunit

      group GroupA
        source https://api.nuget.org/v3/index.json
        nuget Fake
        nuget xunit
    `;
    const lockFileName = '/app/test/paket.lock';
    const lockFileContent = codeBlock`
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
      fs.readLocalFile.mockImplementation(
        (filename: string, _encoding: 'utf8') => {
          expect(filename).toEqual(lockFileName);
          return Promise.resolve(lockFileContent);
        },
      );

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

    it('return null if lock file not found', async () => {
      fs.readLocalFile.mockImplementation(
        (filename: string, _encoding: 'utf8') => {
          expect(filename).toEqual(lockFileName);
          return Promise.resolve(null);
        },
      );

      const result = await extractPackageFile(
        packageFileContent,
        packageFileName,
        config,
      );

      expect(result).toBeNull();
    });

    it('return package name of dependencies file if unknown in lock file', async () => {
      fs.readLocalFile.mockImplementation(
        (filename: string, _encoding: 'utf8') => {
          expect(filename).toEqual(lockFileName);
          return Promise.resolve(codeBlock`
            NUGET
              remote: https://api.nuget.org/v3/index.json
                FSharp.Core (9.0.300)
          `);
        },
      );
      const packageFileContent = codeBlock`
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

    it('resolves version when group name case differs (group names are case-insensitive)', async () => {
      fs.readLocalFile.mockImplementation(
        (filename: string, _encoding: 'utf8') => {
          expect(filename).toEqual(lockFileName);
          return Promise.resolve(codeBlock`
            NUGET
              remote: https://api.nuget.org/v3/index.json
            GROUP groupA
            NUGET
              remote: https://api.nuget.org/v3/index.json
                Fake (5.16)
          `);
        },
      );
      const packageFileContent = codeBlock`
        source https://api.nuget.org/v3/index.json

        group GroupA
          source https://api.nuget.org/v3/index.json
          nuget Fake
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
            depName: 'Fake',
            currentVersion: '5.16',
            datasource: NugetDatasource.id,
            rangeStrategy: 'update-lockfile',
            lockedVersion: '5.16',
          },
        ],
        lockFiles: [lockFileName],
      });
    });
  });
});
