const fs = require('fs');
const { extractDependencies } = require('../../../lib/manager/nuget/extract');

const sample = fs.readFileSync('test/_fixtures/nuget/sample.csproj', 'utf8');

describe('lib/manager/nuget/extract', () => {
  describe('extractDependencies()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns empty for invalid csproj', () => {
      expect(extractDependencies('nothing here', config)).toMatchSnapshot();
    });
    it('extracts all dependencies', () => {
      const res = extractDependencies(sample, config).deps;
      expect(res).toMatchSnapshot();
    });
  });
});
