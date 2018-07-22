const fs = require('fs');
const {
  extractDependencies,
} = require('../../../lib/manager/gitlabci/extract');

const yamlFile = fs.readFileSync(
  'test/_fixtures/gitlabci/gitlab-ci.yaml',
  'utf8'
);

describe('lib/manager/gitlabci/extract', () => {
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
      expect(res.deps).toHaveLength(5);
    });
  });
});
