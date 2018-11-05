const fs = require('fs');
const { extractPackageFile } = require('../../../lib/manager/nuget/extract');

const sample = fs.readFileSync('test/_fixtures/nuget/sample.csproj', 'utf8');

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
