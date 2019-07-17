const fs = require('fs');
const path = require('path');
const { extractPackageFile } = require('../../../lib/manager/mix');

const sample = fs.readFileSync(
  path.resolve(__dirname, './_fixtures/mix.exs'),
  'utf-8'
);

describe('lib/manager/mix/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns empty for invalid dependency file', () => {
      expect(extractPackageFile('nothing here')).toMatchSnapshot();
    });
    it('extracts all dependencies', () => {
      const res = extractPackageFile(sample).deps;
      expect(res).toMatchSnapshot();
    });
  });
});
