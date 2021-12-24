import upath from 'upath';
import { loadFixture } from '../../../test/util';
import { GlobalConfig } from '../../config/global';
import type { RepoGlobalConfig } from '../../config/types';
import type { ExtractConfig } from '../types';
import { extractPackageFile } from './extract';

const config: ExtractConfig = {};

const adminConfig: RepoGlobalConfig = {
  localDir: upath.resolve('lib/manager/nuget/__fixtures__'),
};

describe('manager/nuget/extract', () => {
  describe('extractPackageFile()', () => {
    beforeEach(() => {
      GlobalConfig.set(adminConfig);
    });
    afterEach(() => {
      GlobalConfig.reset();
    });
    it('returns empty for invalid csproj', async () => {
      expect(await extractPackageFile('nothing here', 'bogus', config)).toEqual(
        { deps: [] }
      );
    });
    it('extracts package version dependency', async () => {
      const packageFile =
        'with-centralized-package-versions/Directory.Packages.props';
      const sample = loadFixture(packageFile);
      const res = await extractPackageFile(sample, packageFile, config);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(1);
    });
    it('extracts all dependencies', async () => {
      const packageFile = 'sample.csproj';
      const sample = loadFixture(packageFile);
      const res = await extractPackageFile(sample, packageFile, config);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(17);
    });
    it('extracts all dependencies from global packages file', async () => {
      const packageFile = 'packages.props';
      const sample = loadFixture(packageFile);
      const res = await extractPackageFile(sample, packageFile, config);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(17);
    });
    it('considers NuGet.config', async () => {
      const packageFile = 'with-config-file/with-config-file.csproj';
      const contents = loadFixture(packageFile);
      expect(await extractPackageFile(contents, packageFile, config)).toEqual({
        deps: [
          {
            currentValue: '4.5.0',
            datasource: 'nuget',
            depName: 'Autofac',
            depType: 'nuget',
            registryUrls: [
              'https://api.nuget.org/v3/index.json#protocolVersion=3',
              'https://contoso.com/packages/',
            ],
          },
        ],
      });
    });
    it('considers lower-case nuget.config', async () => {
      const packageFile =
        'with-lower-case-config-file/with-lower-case-config-file.csproj';
      const contents = loadFixture(packageFile);
      expect(await extractPackageFile(contents, packageFile, config)).toEqual({
        deps: [
          {
            currentValue: '4.5.0',
            datasource: 'nuget',
            depName: 'Autofac',
            depType: 'nuget',
            registryUrls: [
              'https://api.nuget.org/v3/index.json#protocolVersion=3',
              'https://contoso.com/packages/',
            ],
          },
        ],
      });
    });
    it('considers pascal-case NuGet.Config', async () => {
      const packageFile =
        'with-pascal-case-config-file/with-pascal-case-config-file.csproj';
      const contents = loadFixture(packageFile);
      expect(await extractPackageFile(contents, packageFile, config)).toEqual({
        deps: [
          {
            currentValue: '4.5.0',
            datasource: 'nuget',
            depName: 'Autofac',
            depType: 'nuget',
            registryUrls: [
              'https://api.nuget.org/v3/index.json#protocolVersion=3',
              'https://contoso.com/packages/',
            ],
          },
        ],
      });
    });
    it('handles malformed NuGet.config', async () => {
      const packageFile =
        'with-malformed-config-file/with-malformed-config-file.csproj';
      const contents = loadFixture(packageFile);
      expect(await extractPackageFile(contents, packageFile, config)).toEqual({
        deps: [
          {
            currentValue: '4.5.0',
            datasource: 'nuget',
            depName: 'Autofac',
            depType: 'nuget',
          },
        ],
      });
    });
    it('handles NuGet.config without package sources', async () => {
      const packageFile =
        'without-package-sources/without-package-sources.csproj';
      const contents = loadFixture(packageFile);
      expect(await extractPackageFile(contents, packageFile, config)).toEqual({
        deps: [
          {
            currentValue: '4.5.0',
            datasource: 'nuget',
            depName: 'Autofac',
            depType: 'nuget',
          },
        ],
      });
    });

    it('handles NuGet.config with whitespaces in package source keys', async () => {
      const packageFile = 'with-whitespaces/with-whitespaces.csproj';
      const contents = loadFixture(packageFile);
      expect(await extractPackageFile(contents, packageFile, config)).toEqual({
        deps: [
          {
            currentValue: '12.0.3',
            datasource: 'nuget',
            depName: 'Newtonsoft.Json',
            depType: 'nuget',
            registryUrls: [
              'https://api.nuget.org/v3/index.json#protocolVersion=3',
              'https://my.myget.org/F/my/auth/guid/api/v3/index.json',
            ],
          },
        ],
      });
    });

    it('ignores local feed in NuGet.config', async () => {
      const packageFile =
        'with-local-feed-in-config-file/with-local-feed-in-config-file.csproj';
      const contents = loadFixture(packageFile);
      expect(await extractPackageFile(contents, packageFile, config)).toEqual({
        deps: [
          {
            currentValue: '4.5.0',
            datasource: 'nuget',
            depName: 'Autofac',
            depType: 'nuget',
            registryUrls: ['https://contoso.com/packages/'],
          },
        ],
      });
    });
    it('extracts registry URLs independently', async () => {
      const packageFile = 'multiple-package-files/one/one.csproj';
      const contents = loadFixture(packageFile);
      const otherPackageFile = 'multiple-package-files/two/two.csproj';
      const otherContents = loadFixture(otherPackageFile);
      expect(await extractPackageFile(contents, packageFile, config)).toEqual({
        deps: [
          {
            currentValue: '4.5.0',
            datasource: 'nuget',
            depName: 'Autofac',
            depType: 'nuget',
            registryUrls: [
              'https://api.nuget.org/v3/index.json',
              'https://example.org/one',
            ],
          },
        ],
      });
      expect(
        await extractPackageFile(otherContents, otherPackageFile, config)
      ).toEqual({
        deps: [
          {
            currentValue: '4.5.0',
            datasource: 'nuget',
            depName: 'Autofac',
            depType: 'nuget',
            registryUrls: [
              'https://api.nuget.org/v3/index.json',
              'https://example.org/two',
            ],
          },
        ],
      });
    });

    it('extracts msbuild-sdks from global.json', async () => {
      const packageFile = 'msbuild-sdk-files/global.json';
      const contents = loadFixture(packageFile);
      expect(
        await extractPackageFile(contents, packageFile, config)
      ).toMatchObject({
        deps: [
          {
            currentValue: '5.0.302',
            depName: 'dotnet-sdk',
            depType: 'dotnet-sdk',
            skipReason: 'unsupported-datasource',
          },
          {
            currentValue: '0.2.0',
            datasource: 'nuget',
            depName: 'YoloDev.Sdk',
            depType: 'msbuild-sdk',
          },
        ],
      });
    });

    it('extracts dotnet-sdk from global.json', async () => {
      const packageFile = 'msbuild-sdk-files/global.1.json';
      const contents = loadFixture(packageFile);
      expect(
        await extractPackageFile(contents, 'global.json', config)
      ).toMatchObject({
        deps: [
          {
            currentValue: '5.0.302',
            depName: 'dotnet-sdk',
            depType: 'dotnet-sdk',
            skipReason: 'unsupported-datasource',
          },
        ],
      });
    });

    it('handles malformed global.json', async () => {
      const packageFile = 'msbuild-sdk-files/invalid-json/global.json';
      const contents = loadFixture(packageFile);
      expect(
        await extractPackageFile(contents, packageFile, config)
      ).toBeNull();
    });

    it('handles not-a-nuget global.json', async () => {
      const packageFile = 'msbuild-sdk-files/not-nuget/global.json';
      const contents = loadFixture(packageFile);
      expect(
        await extractPackageFile(contents, packageFile, config)
      ).toBeNull();
    });

    describe('.config/dotnet-tools.json', () => {
      const packageFile = '.config/dotnet-tools.json';
      const contents = loadFixture('dotnet-tools.json');

      it('works', async () => {
        expect(await extractPackageFile(contents, packageFile, config)).toEqual(
          {
            deps: [
              {
                currentValue: '2.0.0',
                datasource: 'nuget',
                depName: 'minver-cli',
                depType: 'nuget',
              },
            ],
          }
        );
      });

      it('with-config', async () => {
        expect(
          await extractPackageFile(
            contents,
            `with-config-file/${packageFile}`,
            config
          )
        ).toEqual({
          deps: [
            {
              currentValue: '2.0.0',
              datasource: 'nuget',
              depName: 'minver-cli',
              depType: 'nuget',
              registryUrls: [
                'https://api.nuget.org/v3/index.json#protocolVersion=3',
                'https://contoso.com/packages/',
              ],
            },
          ],
        });
      });

      it('wrong version', async () => {
        expect(
          await extractPackageFile(
            contents.replace('"version": 1,', '"version": 2,'),
            packageFile,
            config
          )
        ).toBeNull();
      });

      it('does not throw', async () => {
        expect(await extractPackageFile('{{', packageFile, config)).toBeNull();
      });
    });
  });
});
