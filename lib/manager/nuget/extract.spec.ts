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
      expect(extractPackageFile('nothing here', config)).toMatchSnapshot();
    });
    it('extracts all dependencies', () => {
      const res = extractPackageFile(sample, config).deps;
      expect(res).toMatchSnapshot();
    });
  });
});
