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
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts multiple image lines from docker_container', () => {
      const res = extractPackageFile(workflow1);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(2);
    });
  });
});
