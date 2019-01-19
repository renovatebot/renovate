const fs = require('fs');
const {
  extractPackageFile,
} = require('../../../lib/manager/gradle-wrapper/extract');

const propertiesFile1 = fs.readFileSync(
  'test/_fixtures/gradle-wrapper/gradle-wrapper-1.properties',
  'utf8'
);
const propertiesFile2 = fs.readFileSync(
  'test/_fixtures/gradle-wrapper/gradle-wrapper-2.properties',
  'utf8'
);

describe('lib/manager/gradle-wrapper/extract', () => {
  describe('extractPackageFile()', () => {
    let config;

    beforeEach(() => {
      config = {};
    });

    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here', config)).toBe(null);
    });

    it('extracts bin version line', () => {
      const res = extractPackageFile(propertiesFile1, config);
      expect(res.deps).toMatchSnapshot();
    });

    it('extracts all version line', () => {
      const res = extractPackageFile(propertiesFile2, config);
      expect(res.deps).toMatchSnapshot();
    });
  });
});
