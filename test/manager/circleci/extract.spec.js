const fs = require('fs');
const {
  extractDependencies,
} = require('../../../lib/manager/circleci/extract');

const yamlFile = fs.readFileSync('test/_fixtures/circleci/config.yml', 'utf8');

describe('lib/manager/circleci/extract', () => {
  describe('extractDependencies()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('extracts multiple image lines', () => {
      const res = extractDependencies(yamlFile, config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(4);
    });
  });
});
