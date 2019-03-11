const fs = require('fs');
const {
  extractPackageFile,
} = require('../../../lib/manager/github-actions/extract');

const workflow1 = fs.readFileSync(
  'test/manager/github-actions/_fixtures/main.workflow.1',
  'utf8'
);

describe('lib/manager/github-actions/extract', () => {
  describe('extractPackageFile()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here', config)).toBe(null);
    });
    it('extracts multiple image lines from docker_container', () => {
      const res = extractPackageFile(workflow1, config);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(2);
    });
  });
});
