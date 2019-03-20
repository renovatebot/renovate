const fs = require('fs');
const path = require('path');
const { extractPackageFile } = require('../../../lib/manager/mix');

const sample = fs.readFileSync(
  path.resolve(__dirname, './_fixtures/mix.exs'),
  'utf-8'
);

describe('lib/manager/mix/extract', () => {
  describe('extractPackageFile()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns empty for invalid dependency file', () => {
      expect(extractPackageFile('nothing here', config)).toMatchSnapshot();
    });
    it('extracts all dependencies', () => {
      const res = extractPackageFile(sample, config).deps;
      expect(res).toMatchSnapshot();
    });
  });
});
