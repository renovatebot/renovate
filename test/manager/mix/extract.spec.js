const fs = require('fs');
const { extractPackageFile } = require('../../../lib/manager/mix/extract');

const sample = fs.readFileSync('test/_fixtures/mix/mix.exs', 'utf8');

describe('lib/manager/mix/extract', () => {
  describe('extractPackageFile()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    // it('returns empty for invalid csproj', () => {
    //   expect(extractPackageFile('nothing here', config)).toMatchSnapshot();
    // });
    it('extracts all dependencies', () => {
      const res = extractPackageFile(sample, config).deps;
      expect(res).toMatchSnapshot();
    });
  });
});
