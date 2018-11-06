const fs = require('fs');
const {
  extractPackageFile,
} = require('../../../lib/manager/terraform/extract');

const tf1 = fs.readFileSync('test/_fixtures/terraform/1.tf', 'utf8');
const tf2 = `module "relative" {
  source = "../../modules/fe"
}
`;

describe('lib/manager/terraform/extract', () => {
  describe('extractPackageFile()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here', config)).toBe(null);
    });
    it('extracts', () => {
      const res = extractPackageFile(tf1);
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(14);
      expect(res.deps.filter(dep => dep.skipReason)).toHaveLength(5);
    });
    it('returns null if only local deps', () => {
      expect(extractPackageFile(tf2, config)).toBe(null);
    });
  });
});
