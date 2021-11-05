import * as upath from 'upath';
import { loadFixture } from '../../../test/util';
import { setGlobalConfig } from '../../config/global';
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
      setGlobalConfig(adminConfig);
    });
    afterEach(() => {
      setGlobalConfig();
    });
    it('returns empty for invalid csproj', async () => {
      // FIXME: explicit assert condition
      expect(
        await extractPackageFile('nothing here', 'bogus', config)
      ).toMatchSnapshot();
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
      // FIXME: explicit assert condition
      expect(
        await extractPackageFile(contents, packageFile, config)
      ).toMatchSnapshot();
    });
    it('considers lower-case nuget.config', async () => {
      const packageFile =
        'with-lower-case-config-file/with-lower-case-config-file.csproj';
      const contents = loadFixture(packageFile);
      // FIXME: explicit assert condition
      expect(
        await extractPackageFile(contents, packageFile, config)
      ).toMatchSnapshot();
    });
    it('considers pascal-case NuGet.Config', async () => {
      const packageFile =
        'with-pascal-case-config-file/with-pascal-case-config-file.csproj';
      const contents = loadFixture(packageFile);
      // FIXME: explicit assert condition
      expect(
        await extractPackageFile(contents, packageFile, config)
      ).toMatchSnapshot();
    });
    it('handles malformed NuGet.config', async () => {
      const packageFile =
        'with-malformed-config-file/with-malformed-config-file.csproj';
      const contents = loadFixture(packageFile);
      // FIXME: explicit assert condition
      expect(
        await extractPackageFile(contents, packageFile, config)
      ).toMatchSnapshot();
    });
    it('handles NuGet.config without package sources', async () => {
      const packageFile =
        'without-package-sources/without-package-sources.csproj';
      const contents = loadFixture(packageFile);
      // FIXME: explicit assert condition
      expect(
        await extractPackageFile(contents, packageFile, config)
      ).toMatchSnapshot();
    });
    it('ignores local feed in NuGet.config', async () => {
      const packageFile =
        'with-local-feed-in-config-file/with-local-feed-in-config-file.csproj';
      const contents = loadFixture(packageFile);
      // FIXME: explicit assert condition
      expect(
        await extractPackageFile(contents, packageFile, config)
      ).toMatchSnapshot();
    });
    it('extracts registry URLs independently', async () => {
      const packageFile = 'multiple-package-files/one/one.csproj';
      const contents = loadFixture(packageFile);
      const otherPackageFile = 'multiple-package-files/two/two.csproj';
      const otherContents = loadFixture(otherPackageFile);
      // FIXME: explicit assert condition
      expect(
        await extractPackageFile(contents, packageFile, config)
      ).toMatchSnapshot();
      expect(
        await extractPackageFile(otherContents, otherPackageFile, config)
      ).toMatchSnapshot();
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
      const contents = `{
  "version": 1,
  "isRoot": true,
  "tools": {
    "minver-cli": {
      "version": "2.0.0",
      "commands": ["minver"]
    }
  }
}`;

      it('works', async () => {
        // FIXME: explicit assert condition
        expect(
          await extractPackageFile(contents, packageFile, config)
        ).toMatchSnapshot();
      });

      it('with-config', async () => {
        // FIXME: explicit assert condition
        expect(
          await extractPackageFile(
            contents,
            `with-config-file/${packageFile}`,
            config
          )
        ).toMatchSnapshot();
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
