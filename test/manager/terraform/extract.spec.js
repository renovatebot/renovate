const fs = require('fs');
const {
  extractDependencies,
} = require('../../../lib/manager/terraform/extract');

const tf1 = fs.readFileSync('test/_fixtures/terraform/1.tf', 'utf8');
const tf2 = `module "relative" {
  source = "../../modules/fe"
}
`;

describe('lib/manager/terraform/extract', () => {
  describe('extractDependencies()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns null for empty', () => {
      expect(extractDependencies('nothing here', config)).toBe(null);
    });
    it('extracts', () => {
      const res = extractDependencies(tf1);
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(14);
      expect(res.deps.filter(dep => dep.skipReason)).toHaveLength(5);
    });
    it('returns null if only local deps', () => {
      expect(extractDependencies(tf2, config)).toBe(null);
    });
  });
});
