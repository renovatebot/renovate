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
    it('extracts multiple image lines', () => {
      const res = extractDependencies(yamlFile, config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(6);
    });
  });
});
