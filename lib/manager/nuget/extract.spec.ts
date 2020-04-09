import { readFileSync } from 'fs';
import * as path from 'path';
import { extractPackageFile } from './extract';

describe('lib/manager/nuget/extract', () => {
  describe('extractPackageFile()', () => {
    let config;
    beforeEach(() => {
      config = {
        localDir: path.resolve('lib/manager/nuget/__fixtures__'),
      };
    });
    it('returns empty for invalid csproj', async () => {
      expect(
        await extractPackageFile('nothing here', 'bogus', config)
      ).toMatchSnapshot();
    });
    it('extracts all dependencies', async () => {
      const packageFile = 'sample.csproj';
      const sample = readFileSync(
        path.join(config.localDir, packageFile),
        'utf8'
      );
      const res = await extractPackageFile(sample, packageFile, config);
      expect(res.deps).toMatchSnapshot();
    });

    it('considers NuGet.config', async () => {
      const packageFile = 'with-config-file/with-config-file.csproj';
      const contents = readFileSync(
        path.join(config.localDir, packageFile),
        'utf8'
      );

      expect(
        await extractPackageFile(contents, packageFile, config)
      ).toMatchSnapshot();
    });
    it('considers lower-case nuget.config', async () => {
      const packageFile =
        'with-lower-case-config-file/with-lower-case-config-file.csproj';
      const contents = readFileSync(
        path.join(config.localDir, packageFile),
        'utf8'
      );

      expect(
        await extractPackageFile(contents, packageFile, config)
      ).toMatchSnapshot();
    });
    it('considers pascal-case NuGet.Config', async () => {
      const packageFile =
        'with-pascal-case-config-file/with-pascal-case-config-file.csproj';
      const contents = readFileSync(
        path.join(config.localDir, packageFile),
        'utf8'
      );

      expect(
        await extractPackageFile(contents, packageFile, config)
      ).toMatchSnapshot();
    });
    it('handles malformed NuGet.config', async () => {
      const packageFile =
        'with-malformed-config-file/with-malformed-config-file.csproj';
      const contents = readFileSync(
        path.join(config.localDir, packageFile),
        'utf8'
      );

      expect(
        await extractPackageFile(contents, packageFile, config)
      ).toMatchSnapshot();
    });
    it('handles NuGet.config without package sources', async () => {
      const packageFile =
        'without-package-sources/without-package-sources.csproj';
      const contents = readFileSync(
        path.join(config.localDir, packageFile),
        'utf8'
      );

      expect(
        await extractPackageFile(contents, packageFile, config)
      ).toMatchSnapshot();
    });
  });
});
