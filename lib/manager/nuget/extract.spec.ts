import { readFileSync } from 'fs';
import { extractPackageFile } from './extract';

const sample = readFileSync(
  'lib/manager/nuget/__fixtures__/sample.csproj',
  'utf8'
);

describe('lib/manager/nuget/extract', () => {
  describe('extractPackageFile()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns empty for invalid csproj', () => {
      expect(
        extractPackageFile({ fileContent: 'nothing here', config })
      ).toMatchSnapshot();
    });
    it('extracts all dependencies', () => {
      const res = extractPackageFile({ fileContent: sample, config }).deps;
      expect(res).toMatchSnapshot();
    });
    it('extracts all dependencies when config is undefined', () => {
      const res = extractPackageFile({ fileContent: sample }).deps;
      expect(res).toMatchSnapshot();
    });
  });
});
