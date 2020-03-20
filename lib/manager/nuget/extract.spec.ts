import { readFileSync } from 'fs';
import { extractPackageFile } from './extract';

describe('lib/manager/nuget/extract', () => {
  describe('extractPackageFile()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns empty for invalid csproj', () => {
      expect(
        extractPackageFile('nothing here', 'bogus', config)
      ).toMatchSnapshot();
    });
    it('extracts all dependencies', () => {
      const packageFile = 'lib/manager/nuget/__fixtures__/sample.csproj';
      const sample = readFileSync(packageFile, 'utf8');
      const res = extractPackageFile(sample, packageFile, config).deps;
      expect(res).toMatchSnapshot();
    });
    it('considers NuGet.config', () => {
      const packageFile =
        'lib/manager/nuget/__fixtures__/with-config-file/with-config-file.csproj';
      const contents = readFileSync(packageFile, 'utf8');

      expect(
        extractPackageFile(contents, packageFile, config)
      ).toMatchSnapshot();
    });
  });
});
