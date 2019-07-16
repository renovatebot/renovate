const fs = require('fs');
const { extractPackageFile } = require('../../../lib/manager/gitlabci/extract');

const yamlFile = fs.readFileSync(
  'test/manager/gitlabci/_fixtures/gitlab-ci.yaml',
  'utf8'
);

describe('lib/manager/gitlabci/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts multiple image lines', () => {
      const res = extractPackageFile(yamlFile);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(6);
    });
  });
});
