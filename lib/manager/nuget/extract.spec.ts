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
    it('returns empty for invalid csproj', () => {
      expect(
        extractPackageFile('nothing here', 'bogus', config)
      ).toMatchSnapshot();
    });
    it('extracts all dependencies', () => {
      const packageFile = 'sample.csproj';
      const sample = readFileSync(
        path.join(config.localDir, packageFile),
        'utf8'
      );
      const res = extractPackageFile(sample, packageFile, config).deps;
      expect(res).toMatchSnapshot();
    });
    it('considers NuGet.config', () => {
      const packageFile = 'with-config-file/with-config-file.csproj';
      const contents = readFileSync(
        path.join(config.localDir, packageFile),
        'utf8'
      );

      expect(
        extractPackageFile(contents, packageFile, config)
      ).toMatchSnapshot();
    });
  });
});
