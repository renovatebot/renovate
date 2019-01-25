const fs = require('fs');
const {
  extractPackageFile,
} = require('../../../lib/manager/docker-compose/extract');

const yamlFile = fs.readFileSync(
  'test/_fixtures/docker-compose/docker-compose.1.yml',
  'utf8'
);

describe('lib/manager/docker-compose/extract', () => {
  describe('extractPackageFile()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here', config)).toBe(null);
    });
    it('extracts multiple image lines', () => {
      const res = extractPackageFile(yamlFile, config);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(8);
    });
  });
});
