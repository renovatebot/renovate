const fs = require('fs');
const {
  extractDependencies,
} = require('../../../lib/manager/docker-compose/extract');

const yamlFile = fs.readFileSync(
  'test/_fixtures/docker-compose/docker-compose.1.yml',
  'utf8'
);

describe('lib/manager/docker-compose/extract', () => {
  describe('extractDependencies()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns null for empty', () => {
      expect(extractDependencies('nothing here', config)).toBe(null);
    });
    it('extracts multiple image lines', () => {
      const res = extractDependencies(yamlFile, config);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(7);
    });
  });
});
